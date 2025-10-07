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


import { bold, cyan, green, magenta, red, yellow, gray } from 'colorette';
import fs from 'fs';
import path from 'path';

const time = () => gray(new Date().toISOString().replace('T',' ').replace('Z',''));

export const banner = () => {
  const art = [
    cyan('   _______              __                 __        __   '),
    cyan('  /_  __(_)___ _____   / /____  ____  ____/ /___  __/ /__ '),
    cyan('   / / / / __ `/ __ \\ / __/ _ \\/ __ \\/ __  / __ \\/ / / _ \\'),
    cyan('  / / / / /_/ / / / // /_/  __/ / / / /_/ / /_/ / / /  __/'),
    cyan(' /_/ /_/\\__,_/_/ /_/ \\__/\\___/_/ /_/\\__,_/\\____/_/_/\\___/ '),
    gray('       Telegram Userbot • TypeScript (ESM) • Plugins • Hot-Reload')
  ];
  console.log(art.join('\n'));
};

const fmt = (label: string, color: (s: string)=>string, msg: any[]) => {
  console.log(`${time()} ${color(bold(label))}`, ...msg);
};

export const log = {
  info: (...msg: any[]) => fmt('[INFO]', cyan, msg),
  ok:   (...msg: any[]) => fmt('[ OK ]', green, msg),
  warn: (...msg: any[]) => fmt('[WARN]', yellow, msg),
  err:  (...msg: any[]) => fmt('[ERR ]', red, msg),
  evt:  (...msg: any[]) => fmt('[EVT ]', magenta, msg)
};

export function fileLogger(baseDir: string) {
  const logDir = path.join(baseDir, 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const file = path.join(logDir, `commands-${new Date().toISOString().slice(0,10)}.log`);
  return (line: string) => {
    fs.appendFileSync(file, line + '\n', 'utf8');
  };
}
