const fs = require('node:fs/promises');
const path = require('node:path');
const { createDefaultChampionPool, normalizeChampionPool } = require('../draft-logic');

import type { ChampionPool } from '../types/domain/champion';

interface StoreLog {
  debug?: (message: string, details?: unknown) => void;
}

interface LoadChampionPoolDeps {
  userDataPath: string;
  log?: StoreLog;
}

interface SaveChampionPoolDeps extends LoadChampionPoolDeps {
  nextChampionPool: unknown;
}

function getChampionPoolPath(userDataPath: string): string {
  return path.join(userDataPath, 'champion-pool.json');
}

async function loadChampionPool({ userDataPath, log }: LoadChampionPoolDeps): Promise<ChampionPool> {
  const championPoolPath = getChampionPoolPath(userDataPath);
  try {
    const raw = await fs.readFile(championPoolPath, 'utf8');
    const championPool = normalizeChampionPool(JSON.parse(raw)) as ChampionPool;
    log?.debug?.('Champion pool loaded', { path: championPoolPath, championPool });
    return championPool;
  } catch {
    const championPool = createDefaultChampionPool() as ChampionPool;
    log?.debug?.('Champion pool file not found or invalid; using empty pool', { path: championPoolPath });
    return championPool;
  }
}

async function saveChampionPool({ userDataPath, nextChampionPool, log }: SaveChampionPoolDeps): Promise<ChampionPool> {
  const championPoolPath = getChampionPoolPath(userDataPath);
  const championPool = normalizeChampionPool(nextChampionPool) as ChampionPool;

  await fs.mkdir(path.dirname(championPoolPath), { recursive: true });
  await fs.writeFile(championPoolPath, JSON.stringify(championPool, null, 2), 'utf8');
  log?.debug?.('Champion pool saved', { path: championPoolPath, championPool });
  return championPool;
}

export = {
  getChampionPoolPath,
  loadChampionPool,
  saveChampionPool
};
