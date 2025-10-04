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

import type { PluginModule } from '../types';
import { Api } from 'telegram';

const MENU_THUMB = 'https://files.catbox.moe/ma4al6.jpg';
const MENU_URL = 'https://github.com/slowlyh';

function buildCaption(prefix: string, commands: string[]) {
  const lines = [
    '============================',
    '        USERBOT MENU        ',
    '============================',
    '',
    'AVAILABLE COMMANDS:',
    commands.map(c => `  ${prefix}${c}`).join('\n'),
    '',
    'Tip: ketik "help" untuk melihat menu ini.'
  ];
  return lines.join('\n');
}

const plugin: PluginModule = {
  name: 'menu',
  commands: ['menu', 'help'],
  handler: async ({ event }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;
    const cmds = Object.keys(ctx.registry).sort();
    const caption = buildCaption(ctx.prefix, cmds);
    await ctx.client.sendFile(peer, { file: MENU_THUMB, caption, buttons: [[ new Api.KeyboardButtonUrl({ text: 'Open GitHub', url: MENU_URL }) ]] });
  }
};

module.exports = plugin;
