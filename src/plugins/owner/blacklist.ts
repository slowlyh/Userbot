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

type Entry = string | number
interface BLConfig {
  enabled: boolean
  allow: Entry[] // nama aslinya tetap "allow" untuk kompatibilitas broadcast
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FILE = path.join(__dirname, '..', '..', 'config', 'blacklist.json')

export function loadBlacklist(): BLConfig {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf8')
      const parsed = JSON.parse(raw)
      return {
        enabled: !!parsed.enabled,
        allow: Array.isArray(parsed.allow) ? parsed.allow : []
      }
    }
  } catch (e) {
    console.error('❌ Error load blacklist:', e)
  }
  return { enabled: false, allow: [] }
}

function saveBlacklist(cfg: BLConfig) {
  try {
    const dir = path.dirname(FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2), 'utf8')
  } catch (e) {
    console.error('❌ Error save blacklist:', e)
  }
}

function parseEntry(raw: string): Entry {
  const n = Number(raw)
  return Number.isNaN(n) ? raw.trim() : n
}

const plugin: PluginModule = {
  name: 'blacklist-manager',
  category: 'owner',
  commands: ['bllist', 'bladd', 'blrm', 'blenable', 'bldisable'],
  access: 'owner',
  handler: async ({ event, command, parts }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId
    const cfg = loadBlacklist()

    switch (command) {
      case 'bllist': {
        const list =
          cfg.allow.map((v, i) => `${i + 1}. ${v}`).join('\n') || '(empty)'
        await ctx.client.sendMessage(peer, {
          message: `📋 **Blacklist** ${cfg.enabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n${list}`,
          parseMode: 'markdown'
        })
        break
      }

      case 'blenable':
        cfg.enabled = true
        saveBlacklist(cfg)
        await ctx.client.sendMessage(peer, {
          message: '✅ Blacklist system ENABLED.'
        })
        break

      case 'bldisable':
        cfg.enabled = false
        saveBlacklist(cfg)
        await ctx.client.sendMessage(peer, {
          message: '❌ Blacklist system DISABLED.'
        })
        break

      case 'bladd': {
        if (!parts.length)
          return ctx.client.sendMessage(peer, {
            message: 'Usage: `.bladd <id|username> [more..]`'
          })
        let added = 0
        for (const p of parts) {
          const e = parseEntry(p)
          if (!cfg.allow.includes(e)) {
            cfg.allow.push(e)
            added++
          }
        }
        saveBlacklist(cfg)
        await ctx.client.sendMessage(peer, {
          message: `✅ Added ${added} entr${added === 1 ? 'y' : 'ies'}`
        })
        break
      }

      case 'blrm': {
        if (!parts.length)
          return ctx.client.sendMessage(peer, {
            message: 'Usage: `.blrm <id|username>`'
          })
        const before = cfg.allow.length
        const removeSet = parts.map(parseEntry).map((x) => String(x).toLowerCase())
        cfg.allow = cfg.allow.filter(
          (x) => !removeSet.includes(String(x).toLowerCase())
        )
        saveBlacklist(cfg)
        await ctx.client.sendMessage(peer, {
          message: `🗑️ Removed ${before - cfg.allow.length} entr${before - cfg.allow.length === 1 ? 'y' : 'ies'}.`
        })
        break
      }

      default:
        await ctx.client.sendMessage(peer, {
          message:
            '📘 **Blacklist Manager Help**\n\n' +
            '`bllist` → Tampilkan daftar blacklist\n' +
            '`bladd <id|username>` → Tambah target ke blacklist\n' +
            '`blrm <id|username>` → Hapus target\n' +
            '`blenable` / `bldisable` → Aktif/nonaktif sistem',
          parseMode: 'markdown'
        })
        break
    }
  }
}

export default plugin
