// @ts-check

const fs = require('node:fs/promises');
const path = require('node:path');
const { createDefaultChampionPool, normalizeChampionPool } = require('../draft-logic');

/**
 * @typedef {import('../types/domain/champion').ChampionPool} ChampionPool
 */

/**
 * @typedef {object} StoreLog
 * @property {(message: string, details?: unknown) => void} [debug]
 */

/**
 * @param {string} userDataPath
 * @returns {string}
 */
function getChampionPoolPath(userDataPath) {
  return path.join(userDataPath, 'champion-pool.json');
}

/**
 * @param {object} options
 * @param {string} options.userDataPath
 * @param {StoreLog} [options.log]
 * @returns {Promise<ChampionPool>}
 */
async function loadChampionPool({ userDataPath, log }) {
  const championPoolPath = getChampionPoolPath(userDataPath);
  try {
    const raw = await fs.readFile(championPoolPath, 'utf8');
    const championPool = /** @type {ChampionPool} */ (normalizeChampionPool(JSON.parse(raw)));
    log?.debug?.('Champion pool loaded', { path: championPoolPath, championPool });
    return championPool;
  } catch {
    const championPool = /** @type {ChampionPool} */ (createDefaultChampionPool());
    log?.debug?.('Champion pool file not found or invalid; using empty pool', { path: championPoolPath });
    return championPool;
  }
}

/**
 * @param {object} options
 * @param {string} options.userDataPath
 * @param {unknown} options.nextChampionPool
 * @param {StoreLog} [options.log]
 * @returns {Promise<ChampionPool>}
 */
async function saveChampionPool({ userDataPath, nextChampionPool, log }) {
  const championPoolPath = getChampionPoolPath(userDataPath);
  const championPool = /** @type {ChampionPool} */ (normalizeChampionPool(nextChampionPool));

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
