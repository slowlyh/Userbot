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
import type { PluginModule } from '../../types.js';

const plugin: PluginModule = {
  name: 'ping',
  category: 'info',
  commands: ['ping'],
  access: 'all',
  handler: async ({ event }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;
    const start = Date.now();
    
    try {
      const msg = await ctx.client.sendMessage(peer, { 
        message: 'Pinging...' 
      });
      
      const ms = Date.now() - start;
      
      await ctx.client.editMessage(peer, { 
        message: msg.id,
        text: `Pong! \`${ms}ms\``,
        parseMode: 'markdown'
      });
    } catch (error) {
      const ms = Date.now() - start;
      await ctx.client.sendMessage(peer, { 
        message: `Pong! \`${ms}ms\``,
        parseMode: 'markdown'
      });
    }
  }
};

export default plugin;