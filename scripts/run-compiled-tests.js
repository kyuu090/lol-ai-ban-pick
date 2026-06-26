const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const testDir = path.resolve(__dirname, '..', 'dist-app', 'test');
const testFiles = fs.readdirSync(testDir)
  .filter((fileName) => fileName.endsWith('.test.js'))
  .map((fileName) => path.join(testDir, fileName));

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
