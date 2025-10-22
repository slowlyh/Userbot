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
import { saveGlobalSettings } from '../../loader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PluginModule } from '../../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_FILE = path.join(__dirname, '..', '..', 'config', 'bot-settings.json');

function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

const plugin: PluginModule = {
  name: 'mode-switch',
  category: 'owner',
  commands: ['mode'],
  access: 'owner',
  handler: async ({ event, parts }, ctx) => {
    const peer = event.chatId;
    const settings = { mode: 'public', ...loadSettings() };
    const arg = (parts[0] || '').toLowerCase();

    if (!arg) {
      await ctx.client.sendMessage(peer, {
        message: `🌐 **Current Mode:** ${settings.mode.toUpperCase()}\n\nUsage:\n• \`${ctx.prefix}mode self\`\n• \`${ctx.prefix}mode public\``,
        parseMode: 'markdown'
      });
      return;
    }

    if (!['self', 'public'].includes(arg)) {
      await ctx.client.sendMessage(peer, { message: '❌ Use: `.mode self` or `.mode public`' });
      return;
    }

    settings.mode = arg;
    saveGlobalSettings(settings);

    await ctx.client.sendMessage(peer, {
      message: `✅ **Mode switched to:** *${arg.toUpperCase()}*\n\n- self: only owner can access\n- public: everyone can use`,
      parseMode: 'markdown'
    });
  }
};

export default plugin;
