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
import chokidar from 'chokidar';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import { NewMessage } from 'telegram/events';
import { loadPlugins, unloadAllPlugins, dispatchMessage, registry } from './loader';
import { banner, log } from './logger';
import type { BotContext } from './types';

const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH as string;
const PREFIX = process.env.COMMAND_PREFIX || '.';
let STRING_SESSION = (process.env.STRING_SESSION || '').trim();

if (!API_ID || !API_HASH) { console.error('Harap set API_ID dan API_HASH di .env'); process.exit(1); }
if (!STRING_SESSION) {
  try {
    const jf = path.join(__dirname, '..', 'session', 'string.json');
    if (fs.existsSync(jf)) {
      const raw = fs.readFileSync(jf, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.STRING_SESSION) { STRING_SESSION = String(data.STRING_SESSION); console.log('Loaded STRING_SESSION from session/string.json'); }
    }
  } catch {}
}
if (!STRING_SESSION) { console.error('STRING_SESSION kosong. Jalankan `npm run session` (akan menyimpan ke session/string.json) atau isi ke .env'); process.exit(1); }

const client = new TelegramClient(new StringSession(STRING_SESSION), API_ID, API_HASH, { connectionRetries: 5, useWSS: false });

async function main() {
  banner();
  await client.start({ botAuthToken: undefined as any });
  const me = await client.getMe();
  const label = (me as any).username || (me as any).firstName || 'me';
  log.ok('Userbot connected as', label);

  const ctx: BotContext = { client, Api, prefix: PREFIX, registry };

  const pluginsDir = path.join(__dirname, 'plugins');
  await loadPlugins(pluginsDir, ctx);

  const watcher = chokidar.watch(pluginsDir, { ignoreInitial: true, persistent: true });
  watcher.on('add', (p) => loadPlugins(pluginsDir, ctx, p))
         .on('change', (p) => loadPlugins(pluginsDir, ctx, p))
         .on('unlink', (p) => loadPlugins(pluginsDir, ctx, p, { removed: true }));

  client.addEventHandler(async (event) => { try { await dispatchMessage(event, ctx); } catch (e) { log.err('Handler error:', e); } }, new NewMessage({}));

  log.info('Plugins loaded:', Object.keys(registry).join(', ') || '(none)');
  log.info(`Command prefix: "${PREFIX}"`);
}

process.on('SIGINT', async () => { log.warn('\nShutting down...'); try { unloadAllPlugins(); } catch {} try { await client.disconnect(); } catch {} process.exit(0); });

main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
