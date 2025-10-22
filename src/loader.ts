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
import type { BotContext, CommandHandler, PluginModule } from './types.ts';

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
  mode: 'self' | 'public'; // ✅ new
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  privateChatOnly: false,
  ownerOnly: false,
  enabled: true,
  mode: 'public'
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

export function saveGlobalSettings(settings: GlobalSettings) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save global settings:', err);
  }
}

export function shouldProcessMessage(event: any, ownerId?: string | number): boolean {
  const settings = loadGlobalSettings();
  
  if (!settings.enabled) return false;
  if (settings.mode === 'self' && !isOwner(event, ownerId)) return false;
  if (settings.privateChatOnly) {
    const chat = event?.message?.chat;
    const isPrivate = chat?.className === 'PeerUser' || (chat && 'userId' in chat);
    if (!isPrivate) return false;
  }
  if (settings.ownerOnly && !isOwner(event, ownerId)) return false;
  return true;
}

export function isOwner(event: any, ownerId?: string | number): boolean {
  try {
    const senderId = (event?.message?.senderId ?? event?.senderId)?.toString();
    return senderId && ownerId && senderId === ownerId.toString();
  } catch {
    return false;
  }
}

async function loadFile(filePath: string, ctx: BotContext) {
  if (!/\.(js|ts)$/.test(filePath)) return;
  const fileName = path.basename(filePath);
  if (fileName.startsWith('_') || fileName.includes('.spec.') || fileName.includes('.test.')) return;

  try {
    const fileUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;
    const mod = await import(fileUrl);
    const plugin: PluginModule = mod.default ?? mod;
    if (!plugin?.name || !plugin?.commands?.length || !plugin?.handler) return;

    const accessLevel = plugin.access || 'all';
    for (const cmd of plugin.commands) {
      const name = cmd.toLowerCase();
      const wrapped: CommandHandler = async (params, context) => {
        if (accessLevel === 'owner' && !isOwner(params.event, context.ownerId)) {
          await context.client.sendMessage(params.event.chatId, { message: '🚫 Owner only command.' });
          return;
        }
        try {
          await plugin.handler(params, context);
        } catch (err) {
          console.error(`❌ Error in ${plugin.name}/${cmd}:`, err);
        }
      };
      registry[name] = wrapped;
      categories[name] = [plugin.category];
      accessControl[name] = accessLevel;
    }
    console.log(`✅ Plugin loaded: ${plugin.name} [${plugin.commands.join(', ')}]`);
  } catch (err) {
    console.error(`❌ Failed to load plugin ${filePath}:`, err);
  }
}

export async function loadPlugins(dir: string, ctx: BotContext) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const i of items) {
    const full = path.join(dir, i.name);
    if (i.isDirectory()) await loadPlugins(full, ctx);
    else if (i.isFile()) await loadFile(full, ctx);
  }
}

export function watchPlugins(dir: string, ctx: BotContext) {
  if (!fs.existsSync(dir)) return;
  const watcher = chokidar.watch(dir, { ignoreInitial: true, persistent: true });
  const reload = async () => {
    console.log('🔄 Reloading plugins...');
    for (const k of Object.keys(registry)) delete registry[k];
    for (const k of Object.keys(categories)) delete categories[k];
    for (const k of Object.keys(accessControl)) delete accessControl[k];
    await loadPlugins(dir, ctx);
    console.log('✅ Plugin reload complete.');
  };
  watcher
    .on('add', reload)
    .on('change', reload)
    .on('unlink', reload)
    .on('error', e => console.error('Watcher error:', e));
  console.log(`👀 Watching plugin directory: ${dir}`);
}
