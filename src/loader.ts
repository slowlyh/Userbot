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
import type { BotContext, PluginModule, CommandHandler } from './types';

export const registry: Record<string, CommandHandler> = {};

function clearRequireCache(file: string) {
  const resolved = require.resolve(file);
  if (require.cache[resolved]) delete require.cache[resolved];
}

function attachCommandsFrom(mod: PluginModule | any, ctx: BotContext) {
  if (!mod || typeof mod !== 'object') return [] as string[];
  const { name, commands, handler, init } = mod as PluginModule;
  if (typeof init === 'function') { try { void init(ctx); } catch (e) { console.error(`[${name}] init() error:`, e); } }
  const attached: string[] = [];
  if (Array.isArray(commands) && typeof handler === 'function') {
    for (const cmd of commands) { registry[cmd] = handler; attached.push(cmd); }
  }
  return attached;
}

function detachCommandsFrom(mod: PluginModule | any) {
  if (!mod || typeof mod !== 'object') return;
  const { commands } = mod as PluginModule;
  if (Array.isArray(commands)) for (const cmd of commands) { if (registry[cmd]) delete registry[cmd]; }
}

export async function loadPlugins(dir: string, ctx: BotContext, singlePath?: string, options: { removed?: boolean } = {}) {
  const removed = options.removed === true;
  if (singlePath) {
    const rel = path.relative(dir, singlePath);
    if (!rel || rel.startsWith('..')) return;
    const isTsOrJs = singlePath.endsWith('.ts') || singlePath.endsWith('.js');
    if (!isTsOrJs) return;
    if (removed) { try { const tmp = require(singlePath); detachCommandsFrom(tmp); } catch {} clearRequireCache(singlePath); console.log('🗑️  Unloaded plugin:', path.basename(singlePath)); return; }
    try { clearRequireCache(singlePath); const mod = require(singlePath); const attached = attachCommandsFrom(mod, ctx); console.log('♻️  Reloaded plugin:', path.basename(singlePath), attached.length ? `→ [${attached.join(', ')}]` : ''); }
    catch (e) { console.error('Failed to load plugin', singlePath, e); }
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  for (const f of files) {
    const full = path.join(dir, f);
    try { clearRequireCache(full); const mod = require(full); const attached = attachCommandsFrom(mod, ctx); console.log('🔌 Loaded plugin:', f, attached.length ? `→ [${attached.join(', ')}]` : ''); }
    catch (e) { console.error('Failed to load plugin', f, e); }
  }
}

export function unloadAllPlugins() { for (const key of Object.keys(registry)) delete registry[key]; }

export async function dispatchMessage(event: any, ctx: BotContext) {
  const msg = event?.message;
  const textRaw: string | undefined = msg?.message;
  if (!textRaw) return;
  const { prefix } = ctx;
  if (!textRaw.startsWith(prefix)) return;
  const body = textRaw.slice(prefix.length);
  const m = body.match(/^([^\s]+)\s*([\s\S]*)$/);
  const command = (m?.[1] || '').toLowerCase();
  const argText = m?.[2] ?? '';
  const parts = argText.trim().length ? argText.trim().split(/\s+/) : [];
  const handler = registry[command];
  if (!handler) return;
  await handler({ event, text: argText, command, parts }, ctx);
}
