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

export type CommandContext = {
  event: NewMessageEvent;
  text: string;
  command: string;
  parts: string[];
  category: string;
};

export type CommandHandler = (params: CommandContext, ctx: BotContext) => Promise<void>;

export interface PluginModule {
  name: string;
  commands: string[];
  category: string;
  init?: (ctx: BotContext) => void | Promise<void>;
  handler: CommandHandler;
  
  access?: 'owner' | 'all'; 
}

export interface BotContext {
  client: TelegramClient;
  Api: typeof Api;
  prefix: string;
  registry: Record<string, CommandHandler>;
  categories: Record<string, string[]>;
  logCommand: (meta: LogMeta) => void;
  
  ownerId?: string | number;
}

export interface LogMeta {
  command: string;
  chatId: string;
  chatTitle?: string;
  fromId?: string;
  fromName?: string;
  args?: string;
  ok?: boolean;
  error?: string;
  accessDenied?: boolean;
}
