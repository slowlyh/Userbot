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


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'bot-settings.json');


const DEFAULT_SETTINGS = {
  privateChatOnly: false,
  ownerOnly: false,
  enabled: true
};


interface BotSettings {
  privateChatOnly: boolean;
  ownerOnly: boolean;
  enabled: boolean;
}


function loadSettings(): BotSettings {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const settings = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...settings };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  
  
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}


function saveSettings(settings: BotSettings): void {
  try {
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}


function isOwner(event: any, ownerId?: string | number): boolean {
  if (!ownerId) return false;
  const senderId = (event?.message?.senderId ?? event?.senderId)?.toString();
  return senderId === ownerId.toString();
}


function isPrivateChat(event: any): boolean {
  const chat = event?.message?.chat;
  if (!chat) return false;
  
  return chat.className === 'PeerUser' || 
         (chat instanceof Object && 'userId' in chat);
}

const plugin: PluginModule = {
  name: 'bot-settings',
  category: 'owner',
  commands: ['settings', 'set', 'config', 'mode'],
  access: 'owner',
  handler: async ({ event, command, text, parts }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;
    const settings = loadSettings();

    
    if (command === 'settings' || command === 'config' || !text) {
      const statusEmoji = settings.enabled ? '✅' : '❌';
      const privateEmoji = settings.privateChatOnly ? '🔒' : '🌐';
      const ownerEmoji = settings.ownerOnly ? '👑' : '👥';
      
      const settingsInfo = `
🤖 **Bot Settings** ${statusEmoji}

${privateEmoji} **Private Chat Only:** ${settings.privateChatOnly ? 'ON' : 'OFF'}
${ownerEmoji} **Owner Only Mode:** ${settings.ownerOnly ? 'ON' : 'OFF'}
✅ **Bot Status:** ${settings.enabled ? 'ACTIVE' : 'DISABLED'}

**Usage:**
\`${ctx.prefix}set private on/off\` - Hanya respon di private chat
\`${ctx.prefix}set owner on/off\` - Hanya owner yang bisa chat
\`${ctx.prefix}set enable on/off\` - Aktif/nonaktif bot
\`${ctx.prefix}set reset\` - Reset ke default
      `.trim();

      await ctx.client.sendMessage(peer, {
        message: settingsInfo,
        parseMode: 'markdown'
      });
      return;
    }

    
    if (command === 'set' || command === 'mode') {
      const [setting, value] = parts;
      
      if (!setting) {
        await ctx.client.sendMessage(peer, {
          message: '❌ **Usage:**\n\n`.set private on/off`\n`.set owner on/off`\n`.set enable on/off`\n`.set reset`',
          parseMode: 'markdown'
        });
        return;
      }

      const settingLower = setting.toLowerCase();
      const valueLower = value ? value.toLowerCase() : '';

      if (settingLower === 'reset') {
        saveSettings(DEFAULT_SETTINGS);
        await ctx.client.sendMessage(peer, {
          message: '✅ **Settings reset to default**',
          parseMode: 'markdown'
        });
        return;
      }

      if (valueLower !== 'on' && valueLower !== 'off') {
        await ctx.client.sendMessage(peer, {
          message: '❌ **Value must be `on` or `off`**\n\nContoh: `.set private on`',
          parseMode: 'markdown'
        });
        return;
      }

      const newValue = valueLower === 'on';

      switch (settingLower) {
        case 'private':
          settings.privateChatOnly = newValue;
          saveSettings(settings);
          await ctx.client.sendMessage(peer, {
            message: `✅ **Private Chat Only:** ${newValue ? 'ENABLED' : 'DISABLED'}\n\nBot ${newValue ? 'hanya akan merespon di private chat' : 'akan merespon di semua chat'}`,
            parseMode: 'markdown'
          });
          break;

        case 'owner':
          settings.ownerOnly = newValue;
          saveSettings(settings);
          await ctx.client.sendMessage(peer, {
            message: `✅ **Owner Only Mode:** ${newValue ? 'ENABLED' : 'DISABLED'}\n\nBot ${newValue ? 'hanya akan merespon owner' : 'akan merespon semua user'}`,
            parseMode: 'markdown'
          });
          break;

        case 'enable':
          settings.enabled = newValue;
          saveSettings(settings);
          await ctx.client.sendMessage(peer, {
            message: `✅ **Bot Status:** ${newValue ? 'ACTIVATED' : 'DEACTIVATED'}\n\nBot ${newValue ? 'telah diaktifkan' : 'telah dinonaktifkan'}`,
            parseMode: 'markdown'
          });
          break;

        default:
          await ctx.client.sendMessage(peer, {
            message: '❌ **Invalid setting**\n\nAvailable settings: `private`, `owner`, `enable`',
            parseMode: 'markdown'
          });
      }
    }
  }
};

export default plugin;