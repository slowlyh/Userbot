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
import https from 'https';
import type { PluginModule } from '../../types.js';


async function eaiquery(prompt: string, model: string = "perplexity-ai"): Promise<string> {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            message: prompt,
            model: model,
            history: []
        });

        const options = {
            hostname: 'whatsthebigdata.com',
            port: 443,
            path: '/api/ask-ai/',
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'origin': 'https://whatsthebigdata.com',
                'referer': 'https://whatsthebigdata.com/ai-chat/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.text);
                } catch (error) {
                    reject('❌ Gagal memparse response AI');
                }
            });
        });

        req.on('error', error => reject('❌ Error koneksi: ' + error.message));
        req.setTimeout(30000, () => {
            req.destroy();
            reject('❌ Timeout: AI tidak merespon dalam 30 detik');
        });
        req.write(postData);
        req.end();
    });
}

const plugin: PluginModule = {
    name: 'ai-chat',
    category: 'ai',
    commands: ['ai', 'ask', 'chat'],
    access: 'all',
    handler: async ({ event, text }, ctx) => {
        const peer = (event as any).chatId ?? (event.message as any)?.chatId;
        
        
        if (!text || text.trim().length === 0) {
            await ctx.client.sendMessage(peer, {
                message: `🤖 **AI Chat Bot**\n\nGunakan: \`${ctx.prefix}ai <pertanyaan>\`\n\nContoh:\n\`${ctx.prefix}ai Apa itu artificial intelligence?\`\n\`${ctx.prefix}ai Jelaskan tentang JavaScript\`\n\`${ctx.prefix}ai Buatkan kode HTML sederhana\``,
                parseMode: 'markdown'
            });
            return;
        }

        const prompt = text.trim();
        
        
        try {
            await ctx.client.invoke(new ctx.Api.messages.SetTyping({
                peer: peer,
                action: new ctx.Api.SendMessageTypingAction()
            }));
        } catch (error) {
            
        }

        try {
            
            const processingMsg = await ctx.client.sendMessage(peer, {
                message: '⏳ *Memproses pertanyaan...*',
                parseMode: 'markdown'
            });

            
            const startTime = Date.now();
            const response = await eaiquery(prompt);
            const responseTime = Date.now() - startTime;

            
            let formattedResponse = `🤖 **AI Response** (${responseTime}ms)\n\n`;
            
            if (response.length > 3500) {
                
                formattedResponse += response.substring(0, 3500) + '\n\n... *(response dipotong)*';
            } else {
                formattedResponse += response;
            }

            
            await ctx.client.editMessage(peer, {
                message: processingMsg.id,
                text: formattedResponse,
                parseMode: 'markdown'
            });

        } catch (error: any) {
            console.error('AI Error:', error);
            
            
            await ctx.client.sendMessage(peer, {
                message: `❌ **Error AI**\n\n${error.message || 'Terjadi kesalahan saat memproses pertanyaan'}\n\nCoba lagi beberapa saat.`,
                parseMode: 'markdown'
            });
        }
    }
};

export default plugin;