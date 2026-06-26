const { spawn } = require('node:child_process');
const path = require('node:path');
const electronPath = require('electron');

const projectRoot = path.resolve(__dirname, '..');
const entry = process.argv[2] || '.';

const child = spawn(electronPath, [entry], {
  cwd: projectRoot,
  env: {
    ...process.env,
    LOG_LEVEL: 'debug',
    LOG_TO_CWD: '1'
  },
  shell: false,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
