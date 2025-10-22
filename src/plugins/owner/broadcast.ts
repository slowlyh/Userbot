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

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { PluginModule } from '../../types.js'
import { loadBlacklist } from './blacklist.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'broadcast.json')
const HISTORY_DIR = path.join(__dirname, '..', '..', 'config', 'broadcast-history')

interface BroadcastConfig {
  preview: boolean
}

function loadConfig(): BroadcastConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
    }
  } catch {}
  return { preview: true }
}

function saveConfig(cfg: BroadcastConfig) {
  const dir = path.dirname(CONFIG_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8')
}

function safeMarkdown(text: string) {
  try {
    if (text.match(/[*_`\[\]]/)) return 'markdown'
  } catch {}
  return undefined
}

function logHistory(data: any) {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true })
  const file = path.join(
    HISTORY_DIR,
    `${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  )
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

const BATCH_SIZE = 5

const plugin: PluginModule = {
  name: 'broadcast',
  category: 'owner',
  commands: ['broadcast', 'bc'],
  access: 'owner',
  handler: async ({ event, parts, text }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId
    const blacklist = loadBlacklist()
    const config = loadConfig()

    // toggle preview mode
    if (parts[0] === 'preview') {
      const val = parts[1]?.toLowerCase()
      if (!['on', 'off'].includes(val)) {
        return ctx.client.sendMessage(peer, {
          message: `📢 Preview: ${config.preview ? 'ON' : 'OFF'}\nGunakan: /broadcast preview on/off`
        })
      }
      config.preview = val === 'on'
      saveConfig(config)
      return ctx.client.sendMessage(peer, { message: `✅ Preview ${val.toUpperCase()}` })
    }

    // detect markdown
    let markdown = false
    let type = parts[0]?.toLowerCase()
    let msgText = parts.slice(1).join(' ')
    if (type === '--md') {
      markdown = true
      type = parts[1]?.toLowerCase()
      msgText = parts.slice(2).join(' ')
    }

    if (!['group', 'channel', 'auto'].includes(type)) {
      return ctx.client.sendMessage(peer, {
        message: '❌ Type harus: group / channel / auto'
      })
    }

    if (!msgText && !event.message?.replyToMsgId) {
      return ctx.client.sendMessage(peer, {
        message: '❌ Kirim teks atau reply media untuk broadcast.'
      })
    }

    const dialogs = await ctx.client.getDialogs({})
    const targets = dialogs.filter((d: any) => {
      if (blacklist.allow.includes(String(d.id))) return false
      if (type === 'auto') return d.isGroup || d.isChannel || d.isUser
      if (type === 'group') return d.isGroup
      if (type === 'channel') return d.isChannel
      return false
    })

    if (!targets.length)
      return ctx.client.sendMessage(peer, { message: '❌ Tidak ada target ditemukan.' })

    // preview
    if (config.preview) {
      const previewMsg =
        `📢 **Broadcast Preview**\n\n` +
        `Type: ${type}\n` +
        `Total target: ${targets.length}\n\n` +
        `**Message:**\n${msgText || '(media)'}\n\n` +
        `Balas **yes** untuk kirim atau **cancel** untuk batal.`
      const sentPreview = await ctx.client.sendMessage(peer, {
        message: previewMsg,
        parseMode: 'markdown'
      })

      // wait for reply
      const { NewMessage } = await import('telegram/events/index.js')
      const listener = async (e: any) => {
        if (e.message?.replyTo?.replyToMsgId !== sentPreview.id) return
        const resp = e.message?.message?.toLowerCase().trim()
        if (resp === 'cancel') {
          await ctx.client.sendMessage(peer, { message: '❌ Broadcast dibatalkan.' })
          ctx.client.removeEventHandler(listener)
        } else if (resp === 'yes') {
          ctx.client.removeEventHandler(listener)
          await doBroadcast(ctx, peer, type, msgText, event, targets, markdown, blacklist)
        }
      }
      ctx.client.addEventHandler(listener, new NewMessage({ chats: [peer] }))
      return
    }

    await doBroadcast(ctx, peer, type, msgText, event, targets, markdown, blacklist)
  }
}

async function doBroadcast(
  ctx: any,
  peer: any,
  type: string,
  msgText: string,
  event: any,
  targets: any[],
  markdown: boolean,
  blacklist: any
) {
  const sentTargets: string[] = []
  const failedTargets: string[] = []
  const skipTargets: string[] = []

  let media: Buffer | null = null
  let mimeType = ''
  if (event.message?.replyToMsgId) {
    try {
      const replyMsg = await ctx.client.getMessages(peer, {
        ids: [event.message.replyToMsgId]
      })
      const mediaObj = replyMsg[0]?.media
      if (mediaObj) {
        media = await ctx.client.downloadMedia(mediaObj)
        // try to infer mime
        if (mediaObj?.photo) mimeType = 'image'
        else if (mediaObj?.video) mimeType = 'video'
        else if (mediaObj?.document) mimeType = 'document'
      }
    } catch (e) {
      console.error('❌ Gagal unduh media:', e)
    }
  }

  await ctx.client.sendMessage(peer, {
    message: `📣 Mengirim ke ${targets.length} target...`
  })

  const parse = markdown ? safeMarkdown(msgText) : undefined

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (t: any) => {
        const chatId = t.id
        if (blacklist.allow.includes(String(chatId))) {
          skipTargets.push(String(chatId))
          return
        }
        try {
          if (media) {
            // upload as InputFile agar benar-benar dikirim
            const { CustomFile } = await import('telegram/client/uploads.js')
            const fileName = `broadcast_${Date.now()}.bin`
            const tempFile = path.join(__dirname, '..', '..', 'tmp', fileName)
            fs.mkdirSync(path.dirname(tempFile), { recursive: true })
            fs.writeFileSync(tempFile, media)
            const stat = fs.statSync(tempFile)
            const file = new CustomFile(fileName, stat.size, tempFile)
            const uploaded = await ctx.client.uploadFile({ file })

            await ctx.client.sendMessage(chatId, {
              file: uploaded,
              message: msgText || '',
              parseMode: parse
            })
            fs.unlinkSync(tempFile)
          } else {
            await ctx.client.sendMessage(chatId, {
              message: msgText,
              parseMode: parse
            })
          }
          sentTargets.push(String(chatId))
        } catch (err: any) {
          if (err.errorMessage?.includes('FLOOD_WAIT')) {
            const sec = parseInt(err.errorMessage.split('_').pop())
            await new Promise((r) => setTimeout(r, (sec + 2) * 1000))
            try {
              await ctx.client.sendMessage(chatId, {
                message: msgText,
                parseMode: parse
              })
              sentTargets.push(String(chatId))
            } catch {
              failedTargets.push(String(chatId))
            }
          } else {
            failedTargets.push(String(chatId))
            console.error(`❌ Error kirim ke ${chatId}:`, err.message)
          }
        }
      })
    )
    await new Promise((r) => setTimeout(r, 2000))
  }

  const summary =
    `✅ Broadcast selesai!\n\n` +
    `📤 Berhasil: ${sentTargets.length}\n` +
    `🚫 Gagal: ${failedTargets.length}\n` +
    `⛔ Diblokir: ${skipTargets.length}`

  await ctx.client.sendMessage(peer, { message: summary })
  logHistory({
    type,
    message: msgText,
    sent: sentTargets,
    failed: failedTargets,
    skipped: skipTargets,
    time: new Date().toISOString()
  })
}

export default plugin
