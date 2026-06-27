// @ts-check

const { spawn } = require('node:child_process');
const path = require('node:path');
const electronPath = /** @type {string} */ (/** @type {unknown} */ (require('electron')));

const projectRoot = path.resolve(__dirname, '..');
const entry = process.argv[2] || '.';

/** @type {import('node:child_process').SpawnOptions} */
const spawnOptions = {
  cwd: projectRoot,
  env: {
    ...process.env,
    LOG_LEVEL: 'debug',
    LOG_TO_CWD: '1'
  },
  shell: false,
  stdio: 'inherit'
};

const child = spawn(electronPath, [entry], spawnOptions);

/**
 * @param {number | null} code
 * @param {NodeJS.Signals | null} signal
 */
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
