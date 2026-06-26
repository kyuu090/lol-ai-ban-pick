const fs = require('node:fs/promises');
const path = require('node:path');
const { createDefaultChampionPool, normalizeChampionPool } = require('../draft-logic');

function getChampionPoolPath(userDataPath) {
  return path.join(userDataPath, 'champion-pool.json');
}

async function loadChampionPool({ userDataPath, log }) {
  const championPoolPath = getChampionPoolPath(userDataPath);
  try {
    const raw = await fs.readFile(championPoolPath, 'utf8');
    const championPool = normalizeChampionPool(JSON.parse(raw));
    log?.debug?.('Champion pool loaded', { path: championPoolPath, championPool });
    return championPool;
  } catch {
    const championPool = createDefaultChampionPool();
    log?.debug?.('Champion pool file not found or invalid; using empty pool', { path: championPoolPath });
    return championPool;
  }
}

async function saveChampionPool({ userDataPath, nextChampionPool, log }) {
  const championPoolPath = getChampionPoolPath(userDataPath);
  const championPool = normalizeChampionPool(nextChampionPool);

  await fs.mkdir(path.dirname(championPoolPath), { recursive: true });
  await fs.writeFile(championPoolPath, JSON.stringify(championPool, null, 2), 'utf8');
  log?.debug?.('Champion pool saved', { path: championPoolPath, championPool });
  return championPool;
}

module.exports = {
  getChampionPoolPath,
  loadChampionPool,
  saveChampionPool
};
