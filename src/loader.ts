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
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import type { BotContext, CommandHandler, PluginModule } from './types.js';
import { log } from './logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_FILE = path.join(__dirname, '..', 'config', 'bot-settings.json');

export const registry: Record<string, CommandHandler> = {};
export const categories: Record<string, string[]> = {};
export const accessControl: Record<string, 'owner' | 'all'> = {};

interface GlobalSettings {
  privateChatOnly: boolean;
  ownerOnly: boolean;
  enabled: boolean;
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  privateChatOnly: false,
  ownerOnly: false,
  enabled: true
};


function loadGlobalSettings(): GlobalSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(raw);
      return { ...DEFAULT_GLOBAL_SETTINGS, ...settings };
    }
  } catch (error) {
    console.error('Error loading global settings:', error);
  }
  return DEFAULT_GLOBAL_SETTINGS;
}


export function shouldProcessMessage(event: any, ownerId?: string | number): boolean {
  const settings = loadGlobalSettings();
  
  
  if (!settings.enabled) {
    return false;
  }
  
  
  if (settings.privateChatOnly) {
    const chat = event?.message?.chat;
    const isPrivate = chat?.className === 'PeerUser' || (chat instanceof Object && 'userId' in chat);
    if (!isPrivate) {
      return false;
    }
  }
  
  
  if (settings.ownerOnly) {
    if (!isOwner(event, ownerId)) {
      return false;
    }
  }
  
  return true;
}


export function isOwner(event: any, ownerId?: string | number): boolean {
  if (!ownerId) {
    log.warn('Owner ID not set, allowing access');
    return true; 
  }

  try {
    const senderId = (event?.message?.senderId ?? event?.senderId)?.toString();
    const messageOwnerId = (event?.message?.chatId ?? event?.chatId)?.toString();
    const ownerIdStr = ownerId.toString();

    
    const isOwner = senderId === ownerIdStr || messageOwnerId === ownerIdStr;
    
    return isOwner;
  } catch (error) {
    log.err('Error checking ownership:', error);
    return false;
  }
}


async function loadFile(filePath: string, ctx: BotContext): Promise<void> {
  
  if (!/\.(js|ts)$/.test(filePath)) return;
  
  
  const fileName = path.basename(filePath);
  if (fileName.includes('.test.') || 
      fileName.includes('.spec.') || 
      fileName === 'index.js' || 
      fileName === 'index.ts') {
    return;
  }
  
  const relativePath = path.relative(process.cwd(), filePath);
  
  try {
    
    const fileUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;
    const module = await import(fileUrl);
    
    
    const plugin: PluginModule = module.default ?? module;
    
    if (!plugin || typeof plugin !== 'object') {
      log.err(`Invalid plugin format: ${relativePath}`);
      return;
    }
    
    
    if (!plugin.name || !Array.isArray(plugin.commands) || !plugin.handler) {
      log.err(`Invalid plugin structure in: ${relativePath}`);
      return;
    }
    
    
    if (typeof plugin.init === 'function') {
      try {
        await plugin.init(ctx);
        log.info(`Initialized plugin: ${plugin.name}`);
      } catch (error) {
        log.err(`Failed to initialize plugin ${plugin.name}:`, error);
      }
    }
    
    
    const accessLevel = plugin.access || 'all';
    
    for (const command of plugin.commands) {
      const commandName = command.toLowerCase();
      
      
      const wrappedHandler: CommandHandler = async (params, context) => {
        
        if (accessLevel === 'owner') {
          if (!isOwner(params.event, context.ownerId)) {
            
            try {
              await params.event.message.reply({
                message: '❌ **Access Denied**\nThis command can only be used by the bot owner.'
              });
            } catch (replyError) {
              log.err('Failed to send access denied message:', replyError);
            }
            
            
            context.logCommand({
              command: commandName,
              chatId: params.event.message.chatId?.toString() || 'unknown',
              chatTitle: params.event.message.chat?.title || '',
              fromId: params.event.message.senderId?.toString() || 'unknown',
              fromName: `${params.event.message.sender?.firstName || ''} ${params.event.message.sender?.lastName || ''}`.trim(),
              args: params.text || '',
              ok: false,
              accessDenied: true
            });
            
            return;
          }
        }
        
        
        try {
          await plugin.handler(params, context);
        } catch (error) {
          log.err(`Error in command ${commandName}:`, error);
          throw error;
        }
      };
      
      
      registry[commandName] = wrappedHandler;
      
      
      if (!categories[commandName]) {
        categories[commandName] = [];
      }
      if (!categories[commandName].includes(plugin.category)) {
        categories[commandName].push(plugin.category);
      }
      
      
      accessControl[commandName] = accessLevel;
    }
    
    log.ok(`✅ Loaded: ${plugin.name} → [${plugin.commands.join(', ')}] (access: ${accessLevel})`);
    
  } catch (error) {
    log.err(`❌ Failed to load plugin: ${relativePath}`, error);
  }
}


export async function loadPlugins(dir: string, ctx: BotContext): Promise<void> {
  if (!fs.existsSync(dir)) {
    log.warn(`📁 Plugin directory not found: ${dir}`);
    return;
  }

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        
        await loadPlugins(fullPath, ctx);
      } else if (item.isFile()) {
        
        await loadFile(fullPath, ctx);
      }
    }
    
    
    const totalCommands = Object.keys(registry).length;
    const ownerCommands = Object.values(accessControl).filter(access => access === 'owner').length;
    const publicCommands = totalCommands - ownerCommands;
    
    log.info(`📊 Loaded ${totalCommands} commands (${ownerCommands} owner-only, ${publicCommands} public)`);
    
  } catch (error) {
    log.err('Error loading plugins from directory:', dir, error);
  }
}


export function watchPlugins(dir: string, ctx: BotContext): void {
  if (!fs.existsSync(dir)) {
    log.warn(`Cannot watch non-existent directory: ${dir}`);
    return;
  }

  const watcher = chokidar.watch(dir, {
    ignored: /(^|[\/\\])\..|node_modules/, 
    persistent: true,
    ignoreInitial: true
  });

  const reloadAllPlugins = async (): Promise<void> => {
    log.info('🔄 Detected plugin changes, reloading...');
    
    
    const commandCount = Object.keys(registry).length;
    for (const key of Object.keys(registry)) {
      delete registry[key];
    }
    for (const key of Object.keys(categories)) {
      delete categories[key];
    }
    for (const key of Object.keys(accessControl)) {
      delete accessControl[key];
    }
    
    log.info(`🧹 Cleared ${commandCount} previous commands`);
    
    
    try {
      await loadPlugins(dir, ctx);
      log.info('✅ Plugin reload completed');
    } catch (error) {
      log.err('❌ Failed to reload plugins:', error);
    }
  };

  watcher
    .on('add', (filePath) => {
      log.info(`📄 New plugin detected: ${path.basename(filePath)}`);
      reloadAllPlugins();
    })
    .on('change', (filePath) => {
      log.info(`✏️  Plugin modified: ${path.basename(filePath)}`);
      reloadAllPlugins();
    })
    .on('unlink', (filePath) => {
      log.info(`🗑️  Plugin removed: ${path.basename(filePath)}`);
      reloadAllPlugins();
    })
    .on('error', (error) => {
      log.err('❌ File watcher error:', error);
    });

  log.info(`👀 Watching plugins for changes: ${path.relative(process.cwd(), dir)}`);
}


export function getCommandAccess(command: string): 'owner' | 'all' | undefined {
  return accessControl[command.toLowerCase()];
}


export function listAllCommands(): { command: string; categories: string[]; access: string }[] {
  return Object.keys(registry).map(command => ({
    command,
    categories: categories[command] || [],
    access: accessControl[command] || 'all'
  }));
}


export function commandExists(command: string): boolean {
  return command.toLowerCase() in registry;
}


export function getOwnerCommands(): string[] {
  return Object.entries(accessControl)
    .filter(([_, access]) => access === 'owner')
    .map(([command]) => command)
    .sort();
}


export function getPublicCommands(): string[] {
  return Object.entries(accessControl)
    .filter(([_, access]) => access === 'all')
    .map(([command]) => command)
    .sort();
}
