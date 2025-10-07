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
import https from 'https';
import { fileURLToPath } from 'url';
import type { PluginModule } from '../../types.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


function downloadFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}


function extractGitHubInfo(githubUrl: string): { user: string; repo: string; branch?: string } | null {
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/);
  if (!match) return null;

  return {
    user: match[1],
    repo: match[2],
    branch: match[3] || 'main'
  };
}

const plugin: PluginModule = {
  name: 'update',
  category: 'owner',
  commands: ['update', 'updatesc'],
  access: 'owner',
  handler: async ({ event, text, parts }, ctx) => {
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;

    
    if (!text || parts.length < 2) {
      const usage = `
🔄 **Update Bot System**

**Usage:**
\`${ctx.prefix}update <file_path> <github_url>\`

**Examples:**
\`${ctx.prefix}update src/plugins/menu.ts https://github.com/slowlyh/userbot\`
\`${ctx.prefix}update package.json https://github.com/slowlyh/userbot/tree/main\`

**Note:** 
- Hanya file dalam project directory yang bisa diupdate
- Bot akan restart otomatis setelah update
      `.trim();

      await ctx.client.sendMessage(peer, {
        message: usage,
        parseMode: 'markdown'
      });
      return;
    }

    const [targetPath, githubUrl] = parts;
    const baseDir = path.join(__dirname, '..', '..'); 
    const fullPath = path.resolve(baseDir, targetPath);

    
    if (!fullPath.startsWith(path.resolve(baseDir))) {
      await ctx.client.sendMessage(peer, {
        message: '❌ **Access Denied**\n\nFile path outside project directory.',
        parseMode: 'markdown'
      });
      return;
    }

    
    if (!fs.existsSync(fullPath)) {
      await ctx.client.sendMessage(peer, {
        message: `❌ **File Not Found**\n\n\`${targetPath}\` tidak ditemukan.`,
        parseMode: 'markdown'
      });
      return;
    }

    try {
      
      const githubInfo = extractGitHubInfo(githubUrl);
      if (!githubInfo) {
        await ctx.client.sendMessage(peer, {
          message: '❌ **Invalid GitHub URL**\n\nFormat URL harus: `https://github.com/user/repo`',
          parseMode: 'markdown'
        });
        return;
      }

      
      const processingMsg = await ctx.client.sendMessage(peer, {
        message: `⏳ **Downloading Update**\n\nFile: \`${targetPath}\`\nRepo: ${githubInfo.user}/${githubInfo.repo}`,
        parseMode: 'markdown'
      });

      
      const rawUrl = `https://raw.githubusercontent.com/${githubInfo.user}/${githubInfo.repo}/${githubInfo.branch}/${targetPath}`;

      
      const fileContent = await downloadFile(rawUrl);

      
      const backupPath = `${fullPath}.backup`;
      if (fs.existsSync(fullPath)) {
        fs.copyFileSync(fullPath, backupPath);
      }

      
      fs.writeFileSync(fullPath, fileContent, 'utf8');

      
      await ctx.client.editMessage(peer, {
        message: processingMsg.id,
        text: `✅ **Update Success**\n\nFile: \`${targetPath}\`\nSize: ${fileContent.length} bytes\n\nBackup: \`${targetPath}.backup\``,
        parseMode: 'markdown'
      });

      
      for (let i = 3; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await ctx.client.editMessage(peer, {
          message: processingMsg.id,
          text: `✅ **Update Success**\n\nFile: \`${targetPath}\`\nSize: ${fileContent.length} bytes\n\n🔄 **Restarting in ${i}...**`,
          parseMode: 'markdown'
        });
      }

      
      await ctx.client.editMessage(peer, {
        message: processingMsg.id,
        text: `✅ **Update Complete**\n\nFile: \`${targetPath}\`\n\n🚀 **Restarting bot...**`,
        parseMode: 'markdown'
      });

      
      setTimeout(() => {
        console.log('🔄 Bot restarting after update...');
        process.exit(0);
      }, 1000);

    } catch (error: any) {
      console.error('Update error:', error);

      let errorMessage = '❌ **Update Failed**\n\n';
      
      if (error.message.includes('HTTP 404')) {
        errorMessage += 'File tidak ditemukan di repository GitHub.';
      } else if (error.message.includes('HTTP')) {
        errorMessage += `Error HTTP: ${error.message}`;
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage += 'Tidak dapat terhubung ke GitHub.';
      } else {
        errorMessage += error.message;
      }

      await ctx.client.sendMessage(peer, {
        message: errorMessage,
        parseMode: 'markdown'
      });
    }
  }
};

export default plugin;