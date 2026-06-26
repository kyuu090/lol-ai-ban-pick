const fs = require('node:fs/promises');
const path = require('node:path');

function getAccountDataKey(puuid) {
  return encodeURIComponent(String(puuid || '').trim());
}

function getRiotMatchCachePath(userDataPath, puuid) {
  return path.join(userDataPath, 'riot-match-cache', `${getAccountDataKey(puuid)}.json`);
}

function getMatchHistoryPath(userDataPath, puuid) {
  return path.join(userDataPath, 'match-history', `${getAccountDataKey(puuid)}.json`);
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

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
