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

const plugin: PluginModule = {
  name: 'ping',
  commands: ['ping'],
  handler: async ({ event }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;
    const start = Date.now();
    await ctx.client.sendMessage(peer, { message: 'Pinging...' });
    const ms = Date.now() - start;
    await ctx.client.sendMessage(peer, { message: `Pong! \`${ms}ms\``, parseMode: 'markdown' as any });
  }
};

module.exports = plugin;
