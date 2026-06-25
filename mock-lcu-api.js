(function installMockLcuApi() {
  if (window.lcuApi) return;

  const now = new Date().toISOString();
  const championsById = {
    64: { id: 64, name: 'リーシン', alias: 'LeeSin', title: '盲目の修行僧' },
    121: { id: 121, name: 'カ＝ジックス', alias: 'Khazix', title: '虚空の捕食者' },
    222: { id: 222, name: 'ジンクス', alias: 'Jinx', title: '暴走パンクガール' },
    412: { id: 412, name: 'スレッシュ', alias: 'Thresh', title: '縛鎖の看守' },
    523: { id: 523, name: 'アフェリオス', alias: 'Aphelios', title: '信ずる者の武器' },
    117: { id: 117, name: 'ルル', alias: 'Lulu', title: '森の妖精使い' }
  };
  const championIconColors = {
    222: ['#ff4ea3', '#6336ff'],
    412: ['#43d18b', '#11604d'],
    523: ['#7fa8ff', '#272f66'],
    117: ['#c58cff', '#5a2cbf']
  };

  function createMockChampionIcon(championId) {
    const id = Number(championId);
    const champion = championsById[id];
    if (!champion) return null;

    const [start, end] = championIconColors[id] || ['#7c6cff', '#26306d'];
    const initials = String(champion.name || '?').slice(0, 2);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${start}"/>
            <stop offset="1" stop-color="${end}"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#g)"/>
        <text x="32" y="39" text-anchor="middle" font-size="18" font-weight="700" fill="#fff" font-family="sans-serif">${initials}</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const mockState = {
    settings: {
      lolInstallDir: 'C:\\Riot Games\\League of Legends',
      riotPlatformRegion: 'JP1',
      riotRegionalRoute: 'ASIA',
      riotPlatformRegions: ['JP1', 'KR', 'NA1'],
      themeMode: 'system',
      themeModes: ['system', 'light', 'dark']
    },
    lcuStatus: 'connected',
    websocketStatus: 'connected',
    gameflowPhase: 'InProgress',
    summoner: {
      displayName: 'MockPlayer#JP1',
      gameName: 'MockPlayer',
      tagLine: 'JP1',
      puuid: 'mock-puuid'
    },
    lobby: null,
    champSelect: null,
    championsById,
    championPool: {
      top: [],
      jungle: [64],
      middle: [],
      bottom: [222],
      utility: [412]
    },
    matchHistoryStatus: {
      phase: 'idle',
      message: '',
      error: null
    },
    matchHistorySummary: {
      normalizedMatches: 90,
      oldestGameCreation: Date.now() - 1000 * 60 * 60 * 24 * 60,
      newestGameCreation: Date.now() - 1000 * 60 * 60 * 3
    },
    matchHistoryChampionStats: [
      {
        championId: 222,
        championName: 'ジンクス',
        queueGroup: 'all_sr_5v5',
        position: 'BOTTOM',
        games: 22,
        wins: 13,
        losses: 9,
        winRate: 0.591,
        avgKills: 7.4,
        avgDeaths: 4.9,
        avgAssists: 8.8
      }
    ],
    matchHistoryEnemyChampionStats: [],
    matchHistoryLaneOpponentStats: [],
    matchHistorySelfVsLaneOpponentStats: [],
    gameflowSession: {
      phase: 'InProgress',
      gameData: {
        gameId: 123456789,
        teamOne: [
          { championId: 222, selectedPosition: 'BOTTOM', puuid: 'mock-puuid' },
          { championId: 412, selectedPosition: 'UTILITY' }
        ],
        teamTwo: [
          { championId: 523, selectedPosition: 'BOTTOM' },
          { championId: 117, selectedPosition: 'UTILITY' }
        ]
      }
    },
    laneMatchupAnalysis: {
      status: 'ready',
      requestKey: 'mock-lane-matchup',
      request: {
        gameId: 123456789,
        localPosition: 'BOTTOM',
        opponentPosition: 'BOTTOM',
        laneMatchupLane: 'BOTTOM/SUPPORT',
        localChampionIds: [222, 412],
        enemyChampionIds: [523, 117],
        payload: {
          myChampionName: 'ジンクス/スレッシュ',
          myChampionId: '222/412',
          enemyChampionName: 'アフェリオス/ルル',
          enemyChampionId: '523/117'
        }
      },
      response: {
        difficulty: 'even',
        laneStyle: 'scaling',
        laneSummary: {
          detail: [
            [
              { type: 'champion', championName: 'ジンクス', championId: 222 },
              { type: 'text', text: '/' },
              { type: 'champion', championName: 'スレッシュ', championId: 412 },
              { type: 'text', text: 'は、' },
              { type: 'champion', championName: 'スレッシュ', championId: 412 },
              { type: 'text', text: 'のフックやランタンで主導権を作りつつ、' },
              { type: 'champion', championName: 'ジンクス', championId: 222 },
              { type: 'text', text: 'が安全に装備を進めたい組み合わせです。' }
            ],
            [
              { type: 'champion', championName: 'アフェリオス', championId: 523 },
              { type: 'text', text: '/' },
              { type: 'champion', championName: 'ルル', championId: 117 },
              { type: 'text', text: 'は継続戦と保護が強く、真正面から長く殴り合うと' },
              { type: 'champion', championName: 'ルル', championId: 117 },
              { type: 'text', text: 'のシールドや変身でダメージ交換を返されやすいです。' }
            ],
            [
              { type: 'text', text: 'レベル2先行やジャングル連動で短い仕掛けを作り、無理にオールインを続けず、ウェーブを押し込みすぎない位置でプレッシャーを保つのが安定です。' }
            ]
          ],
          goal: [
            { type: 'champion', championName: 'スレッシュ', championId: 412 },
            { type: 'text', text: 'の仕掛けで短く有利交換を作り、' },
            { type: 'champion', championName: 'ジンクス', championId: 222 },
            { type: 'text', text: 'が安全にスケールできるレーンを維持する' }
          ]
        }
      },
      error: null,
      updatedAt: now
    },
    lastEvent: {
      uri: '/lol-gameflow/v1/session',
      eventType: 'Update'
    },
    error: null,
    updatedAt: now
  };

  window.lcuApi = {
    getState: () => Promise.resolve(mockState),
    refresh: () => Promise.resolve(mockState),
    getChampionIcon: (championId) => Promise.resolve(createMockChampionIcon(championId)),
    getChampionPool: () => Promise.resolve(mockState.championPool),
    saveChampionPool: (championPool) => {
      mockState.championPool = championPool;
      return Promise.resolve(championPool);
    },
    log: () => {},
    getSettings: () => Promise.resolve(mockState.settings),
    chooseLolInstallDir: () => Promise.resolve(mockState.settings),
    updateLolInstallDir: () => Promise.resolve(mockState.settings),
    updateRiotPlatformRegion: () => Promise.resolve(mockState.settings),
    updateThemeMode: (_themeMode) => Promise.resolve(mockState.settings),
    minimizeWindow: () => {},
    toggleMaximizeWindow: () => Promise.resolve(false),
    closeWindow: () => {},
    onWindowMaximized: () => () => {},
    collectRiotMatchHistory: () => Promise.resolve(mockState.matchHistorySummary),
    requestPickPhaseAnalysis: () => Promise.resolve({ notes: [] }),
    requestFinalCompositionAnalysis: () => Promise.resolve({
      notes: [
        {
          title: '序盤の勝ち筋',
          body: 'ボットのレベル2先行とスレッシュのフック圧で、相手に自由なスケール時間を渡さない形を作ります。'
        },
        {
          title: '中盤の注意点',
          body: 'ジンクスの位置を守りながら、ドラゴン前の視界を先に取り、ルルの保護を吐かせてから入り直します。'
        },
        {
          title: '集団戦',
          body: 'スレッシュはキャッチだけでなくランタンでジンクスを守り、リセットが入るまで前に出すぎない形が安定します。'
        }
      ]
    }),
    onState: (callback) => {
      window.setTimeout(() => callback(mockState), 0);
      return () => {};
    }
  };
})();
