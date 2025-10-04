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
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
// @ts-ignore
import input from 'input';
import fs from 'fs';
import path from 'path';

(async () => {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH as string;
  if (!apiId || !apiHash) { console.error('Set API_ID dan API_HASH di .env terlebih dahulu.'); process.exit(1); }

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5, useWSS: false });
  await client.start({
    phoneNumber: async () => await input.text('Masukkan nomor telepon (format internasional): '),
    password: async () => await input.text('2FA (jika ada): '),
    phoneCode: async () => await input.text('Kode OTP yang dikirim Telegram: '),
    onError: (err: unknown) => console.log(err)
  });

  const out = client.session.save();
  console.log('Login berhasil.');
  console.log('STRING_SESSION:\n' + out);

  try {
    const dir = path.join(__dirname, '..', 'session');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'string.json'), JSON.stringify({ STRING_SESSION: out, created_at: new Date().toISOString() }, null, 2), 'utf8');
    console.log('Saved to session/string.json');
  } catch (e) { console.error('Failed to write session/string.json:', e); }

  console.log('→ Salin STRING_SESSION ke .env (opsional), atau langsung jalankan: npm start');
  await client.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
