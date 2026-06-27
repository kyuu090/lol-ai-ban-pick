const fs = require('node:fs/promises');
const path = require('node:path');

type AccountDataKeySource = string | number | null | undefined;

function getAccountDataKey(puuid: AccountDataKeySource): string {
  return encodeURIComponent(String(puuid || '').trim());
}

function getRiotMatchCachePath(userDataPath: string, puuid: AccountDataKeySource): string {
  return path.join(userDataPath, 'riot-match-cache', `${getAccountDataKey(puuid)}.json`);
}

function getMatchHistoryPath(userDataPath: string, puuid: AccountDataKeySource): string {
  return path.join(userDataPath, 'match-history', `${getAccountDataKey(puuid)}.json`);
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<unknown | T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export = {
  getAccountDataKey,
  getMatchHistoryPath,
  getRiotMatchCachePath,
  readJsonFile,
  writeJsonFile
};
