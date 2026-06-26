// @ts-check

const fs = require('node:fs/promises');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'dist-app');

/**
 * @param {string} entry
 */
async function copyEntry(entry) {
  await fs.cp(path.join(projectRoot, entry), path.join(outDir, entry), {
    recursive: true,
    force: true
  });
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
}

if (require.main === module) {
  const mode = process.argv[2];

  if (mode === 'clean') {
    main().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  } else {
    Promise.all([
      copyEntry('assets'),
      copyEntry('img'),
      copyEntry('index.html'),
      copyEntry('styles')
    ]).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}
