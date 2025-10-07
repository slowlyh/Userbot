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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PluginModule } from '../../types.js';

type Entry = number | string;
interface WLConfig { enabled: boolean; allow: Entry[]; }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE = path.join(__dirname, '..', '..', 'config', 'whitelist.json');

function loadCfg(): WLConfig {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return { enabled: !!parsed.enabled, allow: Array.isArray(parsed.allow) ? parsed.allow : [] };
    }
  } catch {}
  return { enabled: false, allow: [] };
}

function saveCfg(cfg: WLConfig) { 
  try { 
    const configDir = path.dirname(FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2), 'utf8'); 
  } catch {} 
}

function parseEntry(raw: string): Entry { 
  const n = Number(raw); 
  if (!Number.isNaN(n) && raw.trim() !== '') return n; 
  return raw.trim(); 
}

const plugin: PluginModule = {
  name: 'whitelist-manager',
  category: 'admin',
  commands: ['wllist', 'wladd', 'wlrm', 'wlenable', 'wldisable'],
  access: 'owner',
  handler: async ({ event, command, parts }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;
    const cfg = loadCfg();
    
    switch (command) {
      case 'wllist':
        const list = cfg.allow.map((v, i) => `${i + 1}. ${v}`).join('\n') || '(empty)';
        await ctx.client.sendMessage(peer, { 
          message: `Whitelist ${cfg.enabled ? 'ENABLED' : 'DISABLED'}\nEntries:\n${list}` 
        });
        break;
        
      case 'wlenable':
        if (cfg.enabled) { 
          await ctx.client.sendMessage(peer, { message: 'Whitelist already ENABLED.' }); 
        } else { 
          cfg.enabled = true; 
          saveCfg(cfg); 
          await ctx.client.sendMessage(peer, { message: 'Whitelist ENABLED.' }); 
        }
        break;
        
      case 'wldisable':
        if (!cfg.enabled) { 
          await ctx.client.sendMessage(peer, { message: 'Whitelist already DISABLED.' }); 
        } else { 
          cfg.enabled = false; 
          saveCfg(cfg); 
          await ctx.client.sendMessage(peer, { message: 'Whitelist DISABLED.' }); 
        }
        break;
        
      case 'wladd':
        if (parts.length === 0) { 
          await ctx.client.sendMessage(peer, { message: 'Usage: .wladd <value> [more..]' }); 
          return; 
        }
        let added = 0;
        for (const raw of parts) {
          const entry = parseEntry(raw);
          const exists = cfg.allow.some((x) => String(x).toLowerCase() == String(entry).toLowerCase());
          if (!exists) { cfg.allow.push(entry); added++; }
        }
        saveCfg(cfg);
        await ctx.client.sendMessage(peer, { 
          message: `Added ${added} entr${added===1?'y':'ies'}. Total: ${cfg.allow.length}` 
        });
        break;
        
      case 'wlrm':
        if (parts.length === 0) { 
          await ctx.client.sendMessage(peer, { message: 'Usage: .wlrm <value> [more..]' }); 
          return; 
        }
        const before = cfg.allow.length;
        const toRemove = parts.map(parseEntry).map((x) => String(x).toLowerCase());
        const next = cfg.allow.filter((x) => !toRemove.includes(String(x).toLowerCase()));
        const removed = before - next.length;
        cfg.allow = next; 
        saveCfg(cfg);
        await ctx.client.sendMessage(peer, { 
          message: `Removed ${removed} entr${removed===1?'y':'ies'}. Total: ${cfg.allow.length}` 
        });
        break;
    }
  }
};

export default plugin;