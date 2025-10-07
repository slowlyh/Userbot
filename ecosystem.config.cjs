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


module.exports = {
  apps: [
    {
      name: "userbot-esm",
      script: "node",
      args: "--loader ts-node/esm --no-warnings src/index.ts",
      cwd: ".",
      watch: false,
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true
    }
  ]
};
