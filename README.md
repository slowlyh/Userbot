# 🚀 Telegram Userbot (TypeScript)

A next-generation **Telegram Userbot** powered by **TypeScript** and [GramJS](https://gram.js.org/).  
Built for developers who want speed, control, and flexibility — all in one modular architecture.

---

## ✨ Highlights

### 🔌 Modular Plugin System
Every command is an independent plugin inside `src/plugins/`, making it simple to add, remove, or modify features.

### 🔁 Auto-Reload Engine
Hot-reload system ensures that **any change in plugins** is instantly applied — no restart required.

### 🔐 Secure Session Manager
Easily create your `STRING_SESSION` with:
```bash
npm run session
```
Your session will be stored in `session/string.json` automatically.

### ✅ Smart Whitelist
Limit commands to specific groups or channels with a few keystrokes.

### 📢 Advanced Broadcast
Send text or media to multiple groups/channels simultaneously with full control:
- Target filters: `--only=groups` / `--only=channels`
- Exclusions: `--except=<id|username>`
- Limits: `--limit=N`
- Markdown / HTML parsing
- Auto FloodWait recovery
- Reply-based media broadcast (`.broadcastmedia`)

---

## 🧱 Project Layout

```
userbot-ts-v3/
├── src/
│   ├── config/           # Configuration files
│   ├── plugins/          # All modular plugin commands
│   ├── index.ts          # Entry point
│   ├── loader.ts         # Plugin loader
│   ├── logger.ts         # Fancy console banner
│   └── types.ts          # Type definitions
├── tools/
│   └── session_gen.ts    # Generate Telegram session string
├── session/              # Session storage
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 🚀 Quick Start

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Setup Environment
Copy `.env.example` → `.env`, then fill your credentials:
```env
API_ID=123456
API_HASH=your_api_hash_here
STRING_SESSION=
COMMAND_PREFIX=.
OWNER_ID=123456789,@yourusername
WHITELIST=
```

### 3️⃣ Generate Session
```bash
npm run session
```

### 4️⃣ Launch the Userbot
```bash
npm run dev
```

---

## 🧾 Example Usage

| Action | Example |
|--------|----------|
| Display Menu | `.menu` |
| Ping Test | `.ping` |
| Send Broadcast | `.broadcast Hello everyone!` |
| Markdown Mode | `.broadcast --md **Update incoming!**` |
| Channel Only | `.broadcast --only=channels` |
| Media Broadcast | *(Reply to a media)* `.broadcastmedia` |

---

## 💡 Tips & Notes

- Use `.whitelist` to toggle access for specific chats.
- Hot reload works automatically on every plugin save.
- Recommended Node.js: **v20+** for best performance.

---

## 🧑‍💻 Credits

Developed by **slowlyh**  
Co-powered by **ChatGPT** ⚙️  
- GitHub: [https://github.com/slowlyh](https://github.com/slowlyh)  
- Website: [https://hyuu.tech](https://hyuu.tech)  
- Contact: [hyuuoffc@gmail.com](mailto:hyuuoffc@gmail.com)

---

## ⚖️ License

```
Copyright © 2025 slowlyh

All rights reserved.
Unauthorized copying, modification, or redistribution of this software,
in any form, is strictly prohibited without prior written permission.
```

---

> 💬 *“Automate smarter, code cleaner, and let your bot handle the rest.”*
