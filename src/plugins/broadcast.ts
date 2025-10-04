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
import type { PluginModule } from '../types';

interface WLConfig { enabled: boolean; allow: (number | string)[]; }
function loadWhitelist(): WLConfig {
  const file = path.join(__dirname, '..', 'config', 'whitelist.json');
  let cfg: WLConfig = { enabled: false, allow: [] };
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<WLConfig>;
      cfg.enabled = !!parsed.enabled;
      cfg.allow = Array.isArray(parsed.allow) ? parsed.allow : [];
    }
  } catch {}
  const envWL = (process.env.WHITELIST || '').trim();
  if (envWL) { cfg.enabled = true; cfg.allow.push(...envWL.split(',').map(s => s.trim()).filter(Boolean)); }
  return cfg;
}
function norm(v: any) { return typeof v === 'bigint' ? v.toString() : String(v).trim(); }
function entityMatchesWhitelist(entity: any, wl: WLConfig): boolean {
  if (!wl.enabled || wl.allow.length === 0) return true;
  const cand = new Set<string>();
  try {
    if (entity?.id !== undefined) cand.add(norm(entity.id));
    if (entity?.username) { const u = String(entity.username).toLowerCase(); cand.add(u); cand.add('@' + u); }
    if (entity?.title) cand.add(String(entity.title));
    if (entity?.firstName || entity?.lastName) { const name = [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim(); if (name) cand.add(name); }
  } catch {}
  for (const allow of wl.allow) {
    const a = norm(allow);
    if (cand.has(a)) return true;
    const lower = a.toLowerCase();
    if ([...cand].some(c => c.toLowerCase() === lower)) return true;
  }
  return false;
}
const isChannel = (e: any) => e?.className === 'Channel' && !!e?.broadcast;
const isGroup   = (e: any, d: any) => d?.isGroup || (e?.className === 'Channel' && e?.megagroup) || e?.className === 'Chat';

function normalizeSet(s: Set<string>) { return new Set([...s].map(x => x.toLowerCase())); }
function targetIdStrings(entity: any) {
  const arr: string[] = [];
  try {
    if (entity?.id !== undefined) arr.push(String(entity.id));
    if (entity?.username) { const u = String(entity.username).toLowerCase(); arr.push(u, '@'+u); }
    if (entity?.title) arr.push(String(entity.title));
  } catch {}
  return arr;
}
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
async function floodAwareSendMsg(client: any, peer: any, payload: any) {
  while (true) {
    try { return await client.sendMessage(peer, payload); }
    catch (e: any) {
      const msg = String(e?.message || e);
      const m = msg.match(/FLOOD_WAIT_(\d+)/) || msg.match(/wait of (\d+) seconds/i);
      const seconds = (e?.seconds as number) || (m ? Number(m[1]) : 0);
      if (seconds > 0 && seconds <= 60) { await new Promise(r => setTimeout(r, (seconds+1)*1000)); continue; }
      throw e;
    }
  }
}
async function floodAwareSendFile(client: any, peer: any, payload: any) {
  while (true) {
    try { return await client.sendFile(peer, payload); }
    catch (e: any) {
      const msg = String(e?.message || e);
      const m = msg.match(/FLOOD_WAIT_(\d+)/) || msg.match(/wait of (\d+) seconds/i);
      const seconds = (e?.seconds as number) || (m ? Number(m[1]) : 0);
      if (seconds > 0 && seconds <= 60) { await new Promise(r => setTimeout(r, (seconds+1)*1000)); continue; }
      throw e;
    }
  }
}

const plugin: PluginModule = {
  name: 'broadcast',
  commands: ['broadcast','broadcastmedia'],
  handler: async ({ event, text }, ctx) => {
    const { client } = ctx;
    const peer = (event as any).chatId ?? (event.message as any)?.chatId;
    const me = await client.getMe();
    const meId = (me as any)?.id;
    if (!isOwner(event, meId)) { await client.sendMessage(peer, { message: 'Unauthorized.' }); return; }

    let only: 'groups' | 'channels' | 'all' = 'all';
    let parseMode: 'markdown' | 'html' | undefined = undefined;
    let limit: number | undefined;
    const exceptSet = new Set<string>();
    let content = text ?? '';

    const flagPattern = /^\s*(--only=(groups|channels)|--md|--html|--limit=(\d+)|--except=([^\n]+))\s*/i;
    while (true) {
      const m = content.match(flagPattern);
      if (!m) break;
      const full = m[0];
      if (m[2]) { only = m[2].toLowerCase() as any; }
      else if (/--md/i.test(m[1])) { parseMode = 'markdown'; }
      else if (/--html/i.test(m[1])) { parseMode = 'html'; }
      else if (m[3]) { limit = Number(m[3]); }
      else if (m[4]) { m[4].split(',').map(s=>s.trim()).filter(Boolean).forEach(x => exceptSet.add(x.toLowerCase())); }
      content = content.slice(full.length);
    }

    const replyId = (event?.message as any)?.replyToMsgId;
    let mediaBuf: Buffer | null = null;
    if (replyId) {
      try {
        const msgs = await client.getMessages(peer, { ids: [replyId] });
        const r = Array.isArray(msgs) ? msgs[0] : msgs;
        if (r && (r as any).media) { mediaBuf = await client.downloadMedia(r); }
      } catch {}
    }

    if (!content.trim() and not mediaBuf):
        content = content

    await floodAwareSendMsg(client, peer, { message: 'Starting broadcast...' });

    const dialogs = await client.getDialogs({});
    const wl = loadWhitelist();
    const exceptLower = normalizeSet(exceptSet);
    const targets: any[] = [];
    for (const d of dialogs) {
      const e: any = d.entity;
      if (!e) continue;
      if (d.isUser) continue;
      const chan = isChannel(e);
      const grp  = isGroup(e, d);
      if (only === 'channels' && !chan) continue;
      if (only === 'groups'   && !grp)  continue;
      if (!(chan || grp)) continue;
      if (!entityMatchesWhitelist(e, wl)) continue;
      const ids = targetIdStrings(e).map(s => s.toLowerCase());
      if (ids.some(x => exceptLower.has(x))) continue;
      targets.push(e);
      if (limit && targets.length >= limit) break;
    }

    let ok = 0, fail = 0;
    for (const p of targets) {
      try {
        if (mediaBuf) {
          await floodAwareSendFile(client, p as any, { file: mediaBuf, caption: content || undefined, parseMode });
        } else {
          await floodAwareSendMsg(client, p as any, { message: content, parseMode });
        }
        ok++;
      } catch { fail++; }
    }

    await floodAwareSendMsg(client, peer, { message: `Broadcast done.\nSent: ${ok}\nFailed: ${fail}\nTargets: ${targets.length}` });
  }
};

module.exports = plugin;
