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
import { Api } from 'telegram';
import type { PluginModule } from '../../types.js';

const GITHUB_URL = 'https://github.com/slowlyh';
const THUMBNAIL_URL = 'https://files.catbox.moe/9p9dur.jpg';

function buildMenuText(ownerLabel: string, prefix: string, commands: Record<string, string[]>): string {
  const byCat = new Map<string, string[]>();
  for (const [cmd, cats] of Object.entries(commands)) {
    const cat = cats[0] || 'misc';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(cmd);
  }
  
  const sections: string[] = [];
  for (const [cat, list] of byCat) {
    sections.push(`**${cat.toUpperCase()}**\n` + list.sort().map(c => `• \`${prefix}${c}\``).join('\n'));
  }
  
  return `🤖 **USERBOT MENU** 🤖

👤 **Owner:** ${ownerLabel}
🔖 **Prefix:** \`${prefix}\`

${sections.join('\n\n')}

📚 **Total Commands:** ${Object.keys(commands).length}
⚡ **Powered by:** [slowlyh](${GITHUB_URL})`;
}

const plugin: PluginModule = {
  name: 'menu',
  category: 'info',
  commands: ['menu', 'help', 'start'],
  access: 'all',
  handler: async ({ event }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;
    const me = await ctx.client.getMe();
    const ownerLabel = (me as any)?.username 
      ? '@' + (me as any).username
      : (me as any)?.firstName || 'Owner';

    const caption = buildMenuText(ownerLabel, ctx.prefix, ctx.categories);

    try {
      
      await ctx.client.sendFile(peer, {
        file: THUMBNAIL_URL,
        caption: caption,
        parseMode: 'markdown'
      });
    } catch (error) {
      console.error('Error sending menu with image:', error);
      
      
      await ctx.client.sendMessage(peer, {
        message: caption,
        parseMode: 'markdown'
      });
    }
  }
};

export default plugin;