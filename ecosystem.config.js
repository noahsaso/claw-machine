module.exports = {
  apps: [
    {
      name: 'claw-machine-backend',
      cwd: './backend',
      script: 'bun',
      args: 'run src/index.ts',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
    {
      name: 'claw-machine-frontend',
      cwd: './frontend',
      script: 'bun',
      args: 'run dev',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
