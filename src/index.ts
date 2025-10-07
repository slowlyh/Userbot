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
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import { NewMessage } from 'telegram/events/index.js';
import { loadPlugins, watchPlugins, registry, categories, isOwner, shouldProcessMessage } from './loader.js';
import type { BotContext, LogMeta } from './types.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH as string;
const PREFIX = process.env.COMMAND_PREFIX || '.';
let STRING_SESSION = (process.env.STRING_SESSION || '').trim();


if (!API_ID || !API_HASH) { 
  console.error('❌ Please set API_ID and API_HASH in .env'); 
  process.exit(1); 
}


if (!STRING_SESSION) {
  try {
    const sessionFile = path.join(__dirname, '..', 'session', 'string.json');
    if (fs.existsSync(sessionFile)) {
      const raw = fs.readFileSync(sessionFile, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.STRING_SESSION) {
        STRING_SESSION = String(data.STRING_SESSION);
      }
    }
  } catch (error) {
    console.error('❌ Error loading session file:', error);
  }
}

if (!STRING_SESSION) { 
  console.error('❌ STRING_SESSION is missing. Run `npm run session` first.'); 
  process.exit(1); 
}


const client = new TelegramClient(
  new StringSession(STRING_SESSION), 
  API_ID, 
  API_HASH, 
  { 
    connectionRetries: 5, 
    useWSS: false 
  }
);

const baseDir = path.join(__dirname, '..');
const pluginsDir = path.join(baseDir, 'src', 'plugins');


function createCommandLogger() {
  return {
    info: (message: string, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ℹ️ ${message}`, ...args);
    },
    
    command: (meta: LogMeta & { responseTime?: number; blockedBy?: string }) => {
      const timestamp = new Date().toLocaleTimeString();
      const status = meta.ok ? '✅' : meta.accessDenied ? '🚫' : meta.blockedBy ? '🔒' : '❌';
      const userInfo = meta.fromName ? `@${meta.fromName}` : `ID:${meta.fromId}`;
      const chatInfo = meta.chatTitle ? `[${meta.chatTitle}]` : `[Chat:${meta.chatId}]`;
      
      let logMessage = `${status} [${timestamp}] ${chatInfo} ${userInfo} → ${PREFIX}${meta.command}`;
      
      if (meta.args) {
        logMessage += ` "${meta.args}"`;
      }
      
      if (meta.responseTime) {
        logMessage += ` (${meta.responseTime}ms)`;
      }
      
      if (meta.blockedBy) {
        logMessage += ` [BLOCKED: ${meta.blockedBy}]`;
      } else if (meta.accessDenied) {
        logMessage += ' [ACCESS DENIED]';
      } else if (meta.error) {
        logMessage += ` [ERROR: ${meta.error}]`;
      }
      
      console.log(logMessage);
    },
    
    system: (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`⚡ [${timestamp}] ${message}`);
    },
    
    error: (message: string, error?: any) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`💥 [${timestamp}] ${message}`, error || '');
    },
    
    warning: (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`⚠️ [${timestamp}] ${message}`);
    }
  };
}

const logger = createCommandLogger();


function fileLogger(baseDir: string) {
  const logDir = path.join(baseDir, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, `commands-${new Date().toISOString().split('T')[0]}.log`);
  
  return (line: string) => {
    try {
      fs.appendFileSync(logFile, line + '\n', 'utf8');
    } catch (error) {
      
    }
  };
}

const writeLog = fileLogger(baseDir);

function logCommand(meta: LogMeta & { responseTime?: number; blockedBy?: string }) {
  
  logger.command(meta);
  
  
  const fileLog = {
    timestamp: new Date().toISOString(),
    ...meta
  };
  writeLog(JSON.stringify(fileLog));
}


function isPrivateChat(event: any): boolean {
  const chat = event?.message?.chat;
  if (!chat) return false;
  
  return chat.className === 'PeerUser' || 
         (chat instanceof Object && 'userId' in chat);
}

async function main() {
  try {
    
    console.log('🤖 Telegram UserBot - Command Logger');
    console.log('=====================================');
    
    
    logger.system('Connecting to Telegram...');
    await client.connect();
    
    
    const isAuthorized = await client.checkAuthorization();
    if (!isAuthorized) {
      throw new Error('Not authorized: STRING_SESSION is invalid or expired.');
    }
    
    
    const me = await client.getMe();
    const ownerId = (me as any)?.id;
    
    logger.system(`Connected as: ${(me as any)?.username || (me as any)?.firstName || 'Unknown'}`);
    logger.system(`Owner ID: ${ownerId}`);
    logger.system(`Command prefix: "${PREFIX}"`);

    
    const ctx: BotContext = { 
      client, 
      Api, 
      prefix: PREFIX, 
      registry, 
      categories, 
      logCommand,
      ownerId
    };

    
    logger.system('Loading plugins...');
    await loadPlugins(pluginsDir, ctx);
    
    const commandCount = Object.keys(registry).length;
    const ownerCommands = Object.keys(registry).filter(cmd => 
      categories[cmd]?.includes('owner')
    ).length;
    
    logger.system(`Loaded ${commandCount} commands (${ownerCommands} owner-only)`);
    logger.system('Available commands: ' + Object.keys(registry).sort().join(', '));
    
    
    if (process.env.NODE_ENV === 'development') {
      watchPlugins(pluginsDir, ctx);
      logger.system('Plugin hot-reload enabled');
    }

    
    client.addEventHandler(async (event) => {
      const msg: any = event?.message;
      const textRaw: string | undefined = msg?.message;
      
      if (!textRaw || !textRaw.startsWith(PREFIX)) return;

      const startTime = Date.now();
      const body = textRaw.slice(PREFIX.length);
      const m = body.match(/^([^\s]+)\s*([\s\S]*)$/);
      const command = (m?.[1] || '').toLowerCase();
      const argText = m?.[2] ?? '';
      const parts = argText.trim().length ? argText.trim().split(/\s+/) : [];

      
      if (!shouldProcessMessage(event, ownerId)) {
        const chatId = String(msg?.chatId ?? '');
        const chatTitle = (msg?.chat || msg?.peerId)?.title || '';
        const fromId = String(msg?.senderId ?? '');
        const fromName = ((msg?.sender && (msg.sender.firstName + ' ' + (msg.sender.lastName||''))) || '').trim();
        
        
        let blockedReason = 'global settings';
        
        logCommand({
          command,
          chatId,
          chatTitle,
          fromId,
          fromName,
          args: argText,
          ok: false,
          blockedBy: blockedReason,
          responseTime: Date.now() - startTime
        });
        
        return;
      }

      const handler = registry[command];
      if (!handler) {
        
        logCommand({
          command,
          chatId: String(msg?.chatId ?? ''),
          chatTitle: (msg?.chat || msg?.peerId)?.title || '',
          fromId: String(msg?.senderId ?? ''),
          fromName: ((msg?.sender && (msg.sender.firstName + ' ' + (msg.sender.lastName||''))) || '').trim(),
          args: argText,
          ok: false,
          error: 'Unknown command'
        });
        return;
      }

      const chatId = String(msg?.chatId ?? '');
      const chatTitle = (msg?.chat || msg?.peerId)?.title || '';
      const fromId = String(msg?.senderId ?? '');
      const fromName = ((msg?.sender && (msg.sender.firstName + ' ' + (msg.sender.lastName||''))) || '').trim();

      
      const isOwnerCommand = categories[command]?.includes('owner');
      const hasAccess = !isOwnerCommand || isOwner(event, ownerId);

      try {
        if (!hasAccess) {
          
          logCommand({
            command,
            chatId,
            chatTitle,
            fromId,
            fromName,
            args: argText,
            ok: false,
            accessDenied: true,
            responseTime: Date.now() - startTime
          });
          return;
        }

        
        await handler({ 
          event, 
          text: argText, 
          command, 
          parts, 
          category: (categories[command]||[])[0] || 'misc' 
        }, ctx);
        
        
        logCommand({
          command,
          chatId,
          chatTitle,
          fromId,
          fromName,
          args: argText,
          ok: true,
          responseTime: Date.now() - startTime
        });
        
      } catch (error: any) {
        
        logCommand({
          command,
          chatId,
          chatTitle,
          fromId,
          fromName,
          args: argText,
          ok: false,
          error: error?.message || String(error),
          responseTime: Date.now() - startTime
        });
      }
    }, new NewMessage({}));

    logger.system('✅ Bot is ready and listening for commands...');
    console.log('=====================================');
    logger.system('🔒 Global access control: ACTIVE');
    logger.system('📝 Command logging started - waiting for user commands...');

  } catch (error) {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
  }
}


process.on('SIGINT', async () => { 
  logger.system('Shutting down...');
  try { 
    await client.disconnect(); 
    logger.system('Disconnected from Telegram');
  } catch (error) {
    logger.error('Error during disconnect:', error);
  } 
  process.exit(0); 
});

process.on('SIGTERM', async () => { 
  logger.system('Received SIGTERM, shutting down...');
  try { 
    await client.disconnect(); 
  } catch (error) {
    logger.error('Error during disconnect:', error);
  } 
  process.exit(0); 
});


main().catch((error) => { 
  logger.error('Fatal error:', error); 
  process.exit(1); 
});