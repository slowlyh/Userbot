/**
 * Copyright © 2025 [ slowlyh ]
 *
 * All rights reserved. This source code is the property of [ ChatGPT ].
 * Unauthorized copying, distribution, modification, or use of this file,
 * via any medium, is strictly prohibited without prior written permission.
 *
 * This software is protected under international copyright laws.
 *
 * Contact: [ hyuuoffc@gmail.com ]
 * GitHub: https://github.com/slowlyh
 * Official: https://hyuu.tech
 */
import type { PluginModule } from '../../types.js'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { Api } from 'telegram'

interface StickerSession {
  packName: string
  stickers: { filePath: string; emoji: string }[]
  createdAt: number
}

const stickerSessions = new Map<number, StickerSession>()
const TEMP_DIR = path.join(process.cwd(), 'tmp', 'stickers')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })
const SESSION_TIMEOUT = 30 * 60 * 1000

function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [id, sess] of stickerSessions.entries()) {
    if (now - sess.createdAt > SESSION_TIMEOUT) cleanupUserFiles(id)
  }
}

function cleanupUserFiles(userId: number) {
  const session = stickerSessions.get(userId)
  if (session) {
    for (const s of session.stickers) {
      try {
        if (fs.existsSync(s.filePath)) fs.unlinkSync(s.filePath)
      } catch {}
    }
  }
  stickerSessions.delete(userId)
}

function isValidPackName(name: string) {
  return name.length >= 3 && name.length <= 64 && /^[a-zA-Z0-9_ ]+$/.test(name)
}

function getUserId(event: any): number {
  const sender =
    event?.sender ||
    event?.message?.fromId ||
    event?.message?.sender ||
    event?.senderId ||
    event?.message?.senderId
  if (typeof sender === 'object' && sender?.value) return Number(sender.value)
  if (typeof sender === 'object' && sender?.userId) return Number(sender.userId)
  if (typeof sender === 'number') return sender
  throw new Error('Failed to identify user ID')
}

async function processImageToSticker(buffer: Buffer, userId: number): Promise<string> {
  const fileName = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.webp`
  const filePath = path.join(TEMP_DIR, fileName)

  const image = sharp(buffer)
  const meta = await image.metadata()
  const w = meta.width || 0, h = meta.height || 0
  if (w < 50 || h < 50) throw new Error('Image too small (min 50x50px)')
  if (w > 2048 || h > 2048) throw new Error('Image too large (max 2048x2048px)')

  let webp = await image
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, lossless: false })
    .toBuffer()

  if (webp.length > 500 * 1024) {
    webp = await image
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 70, lossless: false })
      .toBuffer()
  }

  if (webp.length > 512 * 1024) throw new Error('Sticker too large (max 512KB)')
  fs.writeFileSync(filePath, webp)
  return filePath
}

/**
 * Uploads file to Saved Messages and returns valid InputDocument
 */
async function uploadStickerFile(client: any, filePath: string): Promise<any> {
  try {
    if (!fs.existsSync(filePath)) throw new Error('File not found')
    const stats = fs.statSync(filePath)
    if (stats.size === 0) throw new Error('File empty')

    console.log(`📤 Uploading sticker: ${path.basename(filePath)}`)
    const result = await client.sendFile('me', {
      file: filePath,
      forceDocument: true,
      caption: 'upload_temp_sticker'
    })

    const message = Array.isArray(result) ? result[0] : result
    const doc = message?.media?.document
    if (!doc?.id || !doc?.accessHash) throw new Error('Failed to get document')

    return new Api.InputDocument({
      id: doc.id,
      accessHash: doc.accessHash,
      fileReference: doc.fileReference
    })
  } catch (err: any) {
    console.error('❌ Upload error:', err)
    throw new Error(`Upload failed: ${err.message}`)
  }
}

async function safeDelete(client: any, peer: any, msgId: number) {
  try {
    await client.deleteMessages(peer, [msgId], { revoke: true })
  } catch {}
}

async function updateProgress(client: any, peer: any, msgId: number, current: number, total: number) {
  const progress = Math.round((current / total) * 100)
  const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10))
  try {
    await client.editMessage(peer, { message: msgId, text: `⏳ ${bar} ${progress}% (${current}/${total})` })
  } catch {}
}

const plugin: PluginModule = {
  name: 'spack',
  category: 'tools',
  commands: ['spack'],
  access: 'all',

  handler: async ({ event, text }, ctx) => {
    cleanupExpiredSessions()
    const peer = event.chatId ?? event.message?.chatId
    const msg = (event.message?.message ?? '').trim().split(/\s+/)
    const sub = msg[1]?.toLowerCase() || ''
    const arg = msg.slice(2).join(' ')
    const replyId = event.message?.replyToMsgId

    let userId: number
    try {
      userId = getUserId(event)
    } catch (e: any) {
      return ctx.client.sendMessage(peer, { message: `❌ ${e.message}` })
    }

    try {
      switch (sub) {
        case 'build': {
          if (!arg) return ctx.client.sendMessage(peer, { message: 'Usage: /spack build <pack_name>' })
          if (!isValidPackName(arg))
            return ctx.client.sendMessage(peer, { message: '❌ Invalid name (3–64 chars, letters/numbers/_)' })
          cleanupUserFiles(userId)
          stickerSessions.set(userId, { packName: arg, stickers: [], createdAt: Date.now() })
          return ctx.client.sendMessage(peer, {
            message: `🧩 Pack *${arg}* created!\nSend image and use /spack add 😄\nThen /spack create`,
            parseMode: 'markdown'
          })
        }

        case 'add': {
          const emoji = msg[2] || '😄'
          const sess = stickerSessions.get(userId)
          if (!sess) return ctx.client.sendMessage(peer, { message: 'No active pack, run /spack build <name>' })

          const media = replyId
            ? (await ctx.client.getMessages(peer, { ids: [replyId] }))[0]?.media
            : event.message?.media
          if (!media) return ctx.client.sendMessage(peer, { message: 'Reply to image or send with /spack add 😄' })

          const temp = await ctx.client.sendMessage(peer, { message: '⏳ Processing...' })
          try {
            const buffer = await ctx.client.downloadMedia(media)
            if (!buffer) throw new Error('Failed to download image')
            const pathOut = await processImageToSticker(buffer, userId)
            sess.stickers.push({ filePath: pathOut, emoji })
            await safeDelete(ctx.client, peer, temp.id)
            return ctx.client.sendMessage(peer, {
              message: `✅ Added! ${emoji}\nTotal: ${sess.stickers.length}`,
              parseMode: 'markdown'
            })
          } catch (err: any) {
            await safeDelete(ctx.client, peer, temp.id)
            return ctx.client.sendMessage(peer, { message: `❌ ${err.message}` })
          }
        }

        case 'create': {
          const sess = stickerSessions.get(userId)
          if (!sess) return ctx.client.sendMessage(peer, { message: 'No active pack' })
          if (!sess.stickers.length) return ctx.client.sendMessage(peer, { message: 'No stickers added' })

          const msgProg = await ctx.client.sendMessage(peer, {
            message: `⏳ Uploading ${sess.stickers.length} stickers...`
          })

          try {
            const inputStickers: any[] = []
            for (let i = 0; i < sess.stickers.length; i++) {
              const sticker = sess.stickers[i]
              const doc = await uploadStickerFile(ctx.client, sticker.filePath)
              const item = new Api.InputStickerSetItem({ document: doc, emoji: sticker.emoji })
              inputStickers.push(item)
              await updateProgress(ctx.client, peer, msgProg.id, i + 1, sess.stickers.length)
              await new Promise(r => setTimeout(r, 800))
            }

            const me = await ctx.client.getMe()
            const user = new Api.InputUserSelf()
            const clean = sess.packName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30)
            const shortName = `pack_${clean}_${me.id}_${Date.now().toString(36)}`.slice(0, 64)

            const result = await ctx.client.invoke(
              new Api.stickers.CreateStickerSet({
                userId: user,
                title: sess.packName,
                shortName,
                stickers: inputStickers,
                animated: false,
                videos: false,
                masks: false
              })
            )

            await safeDelete(ctx.client, peer, msgProg.id)
            cleanupUserFiles(userId)
            await ctx.client.sendMessage(peer, {
              message: `🎉 Pack created!\n📛 *${sess.packName}*\n🔗 t.me/addstickers/${shortName}`,
              parseMode: 'markdown'
            })
          } catch (err: any) {
            await safeDelete(ctx.client, peer, msgProg.id)
            console.error('❌ Create failed:', err)
            await ctx.client.sendMessage(peer, { message: `❌ ${err.message}` })
          }
          break
        }

        case 'cancel':
          cleanupUserFiles(userId)
          return ctx.client.sendMessage(peer, { message: '❌ Session cancelled.' })

        case 'info': {
          const s = stickerSessions.get(userId)
          if (!s) return ctx.client.sendMessage(peer, { message: 'No session.' })
          const mins = Math.floor((Date.now() - s.createdAt) / 60000)
          return ctx.client.sendMessage(peer, {
            message: `📦 *${s.packName}*\nStickers: ${s.stickers.length}\n⏰ Remaining: ${30 - mins}m`,
            parseMode: 'markdown'
          })
        }

        default:
          return ctx.client.sendMessage(peer, {
            message:
              `📦 **Sticker Pack Creator**\n\n` +
              `• /spack build <name>\n` +
              `• /spack add 😄 (reply to img)\n` +
              `• /spack create\n` +
              `• /spack info | cancel`,
            parseMode: 'markdown'
          })
      }
    } catch (err: any) {
      console.error('Handler error:', err)
      return ctx.client.sendMessage(peer, { message: `❌ ${err.message}` })
    }
  }
}

export default plugin
