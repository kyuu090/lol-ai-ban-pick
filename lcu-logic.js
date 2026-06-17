function parseLockfile(raw) {
  const [processName, pid, port, password, protocol] = String(raw).trim().split(':');

  if (!port || !password || !protocol) {
    throw new Error('lockfileの形式を読み取れませんでした');
  }

  return { processName, pid, port, password, protocol };
}

function createAuthHeader(password) {
  return `Basic ${Buffer.from(`riot:${password}`).toString('base64')}`;
}

function createChampionsById(championSummary) {
  const champions = Array.isArray(championSummary) ? championSummary : [];

  return champions.reduce((acc, champion) => {
    const championId = Number(champion.id);
    if (!Number.isInteger(championId) || championId <= 0) return acc;

    acc[championId] = {
      id: championId,
      name: champion.name,
      alias: champion.alias,
      title: champion.title,
      squarePortraitPath: champion.squarePortraitPath
    };
    return acc;
  }, {});
}

module.exports = {
  parseLockfile,
  createAuthHeader,
  createChampionsById
};
