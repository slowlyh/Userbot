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

import type { TelegramClient } from 'telegram';
import type { Api } from 'telegram';
import type { NewMessageEvent } from 'telegram/events/NewMessage';

export type CommandHandler = (params: {
  event: NewMessageEvent;
  text: string;
  command: string;
  parts: string[];
}, ctx: BotContext) => Promise<void>;

export interface PluginModule {
  name: string;
  commands: string[];
  init?: (ctx: BotContext) => void | Promise<void>;
  handler: CommandHandler;
}

export interface BotContext {
  client: TelegramClient;
  Api: typeof Api;
  prefix: string;
  registry: Record<string, CommandHandler>;
}
