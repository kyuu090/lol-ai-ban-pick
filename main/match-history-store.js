// @ts-check

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * @param {string | number | null | undefined} puuid
 * @returns {string}
 */
function getAccountDataKey(puuid) {
  return encodeURIComponent(String(puuid || '').trim());
}

/**
 * @param {string} userDataPath
 * @param {string | number | null | undefined} puuid
 * @returns {string}
 */
function getRiotMatchCachePath(userDataPath, puuid) {
  return path.join(userDataPath, 'riot-match-cache', `${getAccountDataKey(puuid)}.json`);
}

/**
 * @param {string} userDataPath
 * @param {string | number | null | undefined} puuid
 * @returns {string}
 */
function getMatchHistoryPath(userDataPath, puuid) {
  return path.join(userDataPath, 'match-history', `${getAccountDataKey(puuid)}.json`);
}

/**
 * @template T
 * @param {string} filePath
 * @param {T} fallback
 * @returns {Promise<unknown | T>}
 */
async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * @param {string} filePath
 * @param {unknown} value
 * @returns {Promise<void>}
 */
async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

module.exports = {
  getAccountDataKey,
  getMatchHistoryPath,
  getRiotMatchCachePath,
  readJsonFile,
  writeJsonFile
};
