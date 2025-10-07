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
import util from 'util';

function isOwner(event: any, meId: string | number | bigint): boolean {
  const allowEnv = (process.env.OWNER_ID || '').trim();
  const sender = (event?.message?.senderId ?? event?.senderId);
  if (!allowEnv) return true;
  const list = allowEnv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const sid = String(sender ?? '').toLowerCase();
  const me = String(meId ?? '').toLowerCase();
  if (sid && list.includes(sid)) return true;
  if (me && list.includes(me)) return true;
  return false;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const plugin: PluginModule = {
  name: 'eval',
  category: 'owner',
  commands: ['eval', 'ev'],
  access: 'owner',
  handler: async ({ event, text }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;
    const me = await ctx.client.getMe();
    
    if (!isOwner(event, (me as any)?.id)) { 
      await ctx.client.sendMessage(peer, { message: '❌ Unauthorized.' }); 
      return; 
    }

    const code = (text || '').trim();
    if (!code) { 
      await ctx.client.sendMessage(peer, { message: '📝 Usage: .eval <code>' }); 
      return; 
    }

    const started = Date.now();
    let result: any;
    let success = true;
    
    try {
      
      let processedCode = code;
      
      
      if (!code.includes('return') && 
          !code.trim().startsWith('await') && 
          !code.includes(';') &&
          code.split('\n').length === 1) {
        
        processedCode = `return ${code}`;
      }
      
      const fn = new AsyncFunction(
        'ctx', 'client', 'event', 'require', 'console', 
        processedCode
      );
      
      const { createRequire } = await import('module');
      const customRequire = createRequire(import.meta.url);
      
      
      result = await fn(ctx, ctx.client, event, customRequire, console);
      
    } catch (error: any) {
      result = error;
      success = false;
    }
    
    const ms = Date.now() - started;
    
    
    let output: string;
    
    if (!success) {
      
      output = `❌ **Error after ${ms}ms:**\n\`\`\`\n${result?.stack || result?.message || String(result)}\n\`\`\``;
    } else if (result === undefined || result === null) {
      
      output = `⚡ **Executed in ${ms}ms**\n\`\`\`\n// Code executed successfully but returned no value\n${code}\n\`\`\``;
    } else {
      
      const inspected = util.inspect(result, { 
        depth: 2, 
        maxArrayLength: 20, 
        colors: false,
        showHidden: false
      });
      
      output = `✅ **Result (${ms}ms):**\n\`\`\`javascript\n${inspected}\n\`\`\``;
    }
    
    
    const MAX_LENGTH = 4000;
    if (output.length > MAX_LENGTH) {
      output = output.slice(0, MAX_LENGTH - 10) + '\n\`\`\`\n... (truncated)';
    }
    
    await ctx.client.sendMessage(peer, { 
      message: output,
      parseMode: 'markdown'
    });
  }
};

export default plugin;