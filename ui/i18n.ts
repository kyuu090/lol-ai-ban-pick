(function attachUiI18n(root: UiRoot) {
  type Language = 'en' | 'ja' | 'kr';
  type TranslationValues = Record<string, string | number>;

  const DEFAULT_LANGUAGE: Language = 'en';
  const messages: Record<Language, Record<string, string>> = {
    en: {
      'settings.installDirectory': 'Installation directory',
      'window.controls': 'Window controls', 'window.minimize': 'Minimize', 'window.close': 'Close', 'window.viewSwitcher': 'View switcher',
      'header.matchData': '5v5 SR match data', 'header.downloadRecent': 'Download recent match', 'header.downloadSeason': 'Download current season matches',
      'nav.draft': 'Draft', 'nav.pool': 'ChampionPool', 'nav.champions': 'Champions', 'nav.stats': 'Stats', 'nav.settings': 'Settings',
      'home.client': 'League Client', 'home.launch': 'Launch League of Legends', 'home.loginHelp': 'Once you log in, this screen will show how to use draft assistance.', 'home.connectionHelp': "If this screen does not change after launching League of Legends, check the game's installation directory in Settings.",
      'home.ready': 'Ready', 'home.readyToDraft': 'You are ready to start a draft.', 'home.addPool': 'Add champions for each role in ChampionPool.', 'home.startDraft': "Start a Summoner's Rift draft.", 'home.draftHelp': 'When champion select starts, this screen switches automatically and shows ban/pick candidates and recommended builds.', 'home.otherFeatures': 'Other features', 'home.championsHelp': 'View builds, runes, skill priorities, and matchup data for each champion.', 'home.statsHelp': 'Review your results on played champions and against lane opponents.',
      'home.unsupported': 'Unsupported mode', 'home.unsupportedTitle': 'An unsupported game mode is active', 'home.unsupportedHelp': "Draft assistance is available in Summoner's Rift draft pick, ranked, custom draft, and tournament draft games.", 'home.currentGame': 'Current game', 'home.nextDraft': 'The next draft will be monitored when this game ends.',
      'draft.allyBans': 'Ally bans', 'draft.pick': 'Draft pick', 'draft.championSelect': 'Champion select', 'draft.enemyBans': 'Enemy bans', 'draft.yourTeam': 'Your team', 'draft.currentState': 'Current state', 'draft.enemyTeam': 'Enemy team', 'pool.empty': 'No champions have been added yet.',
      'static.patch': 'Patch', 'static.region': 'Region', 'static.rank': 'Rank', 'static.lane': 'Lane', 'static.allRanks': 'All ranks', 'static.loadingMetadata': 'Loading Stats API metadata.', 'static.tier': 'Tier', 'static.champion': 'Champion', 'static.games': 'Games', 'static.pickRate': 'Pick', 'static.banRate': 'Ban', 'static.championDetails': 'Champion details', 'static.playedChampions': 'Played champions', 'static.laneOpponents': 'Lane opponents', 'static.minGames': 'Min. games', 'static.playedStatistics': 'Played champion statistics', 'static.winRate': 'Win rate', 'static.laneOpponentStatistics': 'Lane opponent statistics', 'static.matchups': 'Matchups', 'static.yourKda': 'Your K/D/A', 'settings.matchV5Route': 'Match-V5 regional route',
      'window.laneSwitcher': 'Lane switcher', 'window.statsSwitcher': 'Statistics switcher', 'window.backToChampions': 'Back to champion list',
      'static.noData': 'No data', 'static.noMatchData': 'No match data has been downloaded.', 'static.hello': 'Hello', 'static.waiting': 'Waiting',
      'settings.browse': 'Browse',
      'settings.save': 'Save',
      'settings.routeHelp': 'Detected automatically from the LCU after you log in to League of Legends.',
      'settings.theme': 'Theme',
      'settings.theme.system': 'System',
      'settings.theme.light': 'Light',
      'settings.theme.dark': 'Dark',
      'settings.theme.systemHelp': 'Matches your operating system appearance.',
      'settings.language': 'Language',
      'settings.savedAndReconnecting': 'Saved. Checking the connection status again.',
      'settings.saveFailed': 'Could not save: {message}',
      'settings.themeSaved': 'Theme preference saved.',
      'settings.languageSaved': 'Language preference saved.',
      'settings.detectedRoute': 'Server detected from LCU: {platformRegion} / Match-V5 route: {regionalRoute}',
      'settings.waitingForRoute': 'Detected automatically from the LCU after you log in to League of Legends.'
      , 'champions.search': 'Search champions'
      , 'champions.none': 'None'
      , 'champions.opponent': 'Lane opponent'
      , 'champions.opponentSearch': 'Search lane opponents'
      , 'champions.build': 'Build'
      , 'champions.timeline': 'Timeline analysis'
      , 'champions.matchups': 'Matchup analysis'
      , 'champions.keystone': 'Keystone'
      , 'champions.selectKeystone': 'Select a keystone'
      , 'champions.runeSets': 'Rune sets'
      , 'champions.summonerSpells': 'Summoner spells'
      , 'champions.runeShards': 'Rune shards'
      , 'champions.startingItems': 'Starting items'
      , 'champions.boots': 'Boots'
      , 'champions.itemBuild': 'Item build'
      , 'champions.skillOrder': 'Skill order'
      , 'champions.skillPriority': 'Skill priority'
      , 'champions.start': 'Start'
      , 'matchData.none': 'No match data has been downloaded.'
      , 'matchData.unknownPeriod': 'Unknown period'
      , 'stats.noOpponentData': 'No lane opponent data matches the selected filters.'
      , 'stats.noPlayedData': 'No played champion results match the selected filters.'
      , 'draft.noRunes': 'No rune recommendations available.'
      , 'draft.noSummonerSpells': 'No summoner spell recommendations available.'
      , 'draft.runeSets': 'Rune sets'
      , 'draft.summonerSpells': 'Summoner spells'
      , 'draft.loadingRecommendations': 'Loading recommendations from Stats API.'
      , 'draft.recommendationsUnavailable': 'Could not load recommendations.'
      , 'draft.noRecommendations': 'No recommendation data is available.'
      , 'draft.analysis.title': 'Ban/pick analysis'
      , 'draft.analysis.finalTitle': 'Final composition analysis'
      , 'draft.analysis.loading': 'Requesting AI analysis…'
      , 'draft.analysis.finalLoading': 'Requesting final composition analysis…'
      , 'draft.analysis.waiting': 'Waiting for AI analysis…'
      , 'draft.analysis.unavailable': 'Could not display AI analysis.'
      , 'draft.analysis.noBans': 'No bans'
      , 'draft.action.yourBan': 'Your ban'
      , 'draft.action.yourPick': 'Your pick'
      , 'draft.action.waiting': 'Waiting'
      , 'draft.plannedPick': '{champion} planned'
      , 'draft.pickPending': 'Pick pending'
      , 'draft.matchup.loadingCounters': 'Loading counter recommendations from Stats API.'
      , 'draft.matchup.loadingAdvantage': 'Loading advantageous recommendations from Stats API.'
      , 'draft.matchup.unavailable': 'Could not load matchup recommendations.'
      , 'draft.matchup.noData': 'No data available ({minGames}+ games)'
      , 'draft.matchup.winRate': 'WR'
      , 'inGame.noCandidates': 'No recommendations'
      , 'inGame.recommendationPending': 'Recommended builds and skill order will appear once champion and role are confirmed.'
      , 'inGame.skillPending': 'Skill order will appear once champion and role are confirmed.'
      , 'inGame.matchupPending': 'Available once the opposing lane champion is confirmed.'
      , 'inGame.loadingRecommendations': 'Loading recommendations from Stats API.'
      , 'inGame.recommendationsUnavailable': 'Could not load recommendations.'
      , 'inGame.noRecommendationData': 'No recommendation data is available.'
      , 'inGame.recommendationTabs': 'Switch recommendation view'
      , 'inGame.skillPriority': 'Skill priority'
      , 'inGame.title': 'In game'
      , 'inGame.opponent': 'opponent'
      , 'inGame.pickMemo': 'Your pick notes will appear here when draft information is available.'
      , 'inGame.final.loading': 'Requesting final composition analysis…'
      , 'inGame.final.waiting': 'Waiting for final composition analysis…'
      , 'inGame.final.unavailable': 'Could not display AI analysis.'
      , 'inGame.lane.loading': 'Requesting lane matchup analysis…'
      , 'inGame.lane.waiting': 'Waiting for lane matchup information from GameStart / InProgress.'
      , 'inGame.lane.unavailable': 'Could not load lane matchup analysis.'
      , 'stats.noMatchingPicks': 'No matching picks.'
      , 'stats.winningPicks': 'Your winning picks'
      , 'stats.losingPicks': 'Your losing picks'
      , 'stats.strongMatchups': 'Strong matchups'
      , 'stats.weakMatchups': 'Weak matchups'
      , 'pool.noMatchingChampions': 'No matching champions found.'
      , 'pool.waitingForChampions': 'Champion list will load after connecting to the League Client.'
      , 'pool.saved': 'Champion pool saved.'
      , 'pool.saveFailed': 'Could not save: {message}'
      , 'pool.alreadySelected': '{champion} is already in the pool'
      , 'pool.removeChampion': 'Remove {champion}'
      , 'stats.showPicksAgainst': 'Show your picks against {champion}'
      , 'stats.showMatchupsFor': 'Show matchup results for {champion}'
      , 'common.statsApiUnavailable': 'Stats API request helper is unavailable.'
      , 'common.statsApiLoadFailed': 'Could not load Stats API data.'
      , 'common.noSkillRecommendations': 'No skill recommendations available.'
      , 'home.unselected': 'Not selected'
      , 'home.noMatchData': 'No matching match data.'
      , 'home.noLaneData': 'No matching lane data.'
      , 'home.noChampionResults': 'No matching champion results.'
      , 'home.noPickResults': 'No pick results.'
      , 'home.weakPicks': 'Weak picks'
      , 'home.strongPicks': 'Strong picks'
      , 'home.aiUnavailable': 'Could not load AI analysis.'
      , 'champions.noMatchingChampions': 'No champions match the selected filters.'
      , 'champions.noSearchResults': 'No champions match your search.'
      , 'champions.noMatchupData': 'No matchup data matches these filters.'
      , 'champions.noMinimumMatchups': 'No matchups meet the minimum game count.'
      , 'champions.noTimelineData': 'No timeline data matches these filters.'
      , 'champions.noSnapshots': 'No matches contain regular timeline snapshots.'
      , 'champions.analysisMenu': 'Champion analysis menu'
      , 'champions.sortBy': 'Sort by {label}'
      , 'champions.refresh': 'Refresh'
      , 'champions.loading': 'Loading'
      , 'champions.details': 'Details'
      , 'champions.noRecommendations': 'No recommendations available.'
      , 'champions.noKeystoneDetails': 'No keystone details are available.'
      , 'champions.noKeystoneOptions': 'No keystone options are available.'
      , 'champions.noBuildData': 'No build data matches these filters.'
      , 'window.restore': 'Restore window'
      , 'window.maximize': 'Maximize window'
      , 'draft.greeting': 'Hello {name}'
      , 'ai.noDisplay': 'Could not display AI analysis.'
      , 'ai.rateLimited': 'AI analysis is busy. Please try again shortly.'
      , 'ai.insufficientDraft': 'Draft information is insufficient for AI analysis.'
      , 'ai.unavailable': 'Could not load AI analysis.'
      , 'season.title': 'Download all season match data'
      , 'season.eyebrow': 'MATCH DATA'
      , 'season.description': "Download this season's match data to increase the sample size for ban/pick analysis."
      , 'season.estimatedTime': 'Estimated time'
      , 'season.totalMatches': 'Total matches'
      , 'season.notDownloaded': 'Not downloaded'
      , 'season.note': 'This may take time depending on the number of matches. You can continue using the app while it downloads.'
      , 'season.cancel': 'Cancel'
      , 'season.startDownload': 'Start download'
      , 'season.matches': 'matches'
      , 'rune.keystone.8005': 'Press the Attack', 'rune.keystone.8008': 'Lethal Tempo', 'rune.keystone.8010': 'Conqueror', 'rune.keystone.8021': 'Fleet Footwork'
      , 'rune.keystone.8112': 'Electrocute', 'rune.keystone.8124': 'Predator', 'rune.keystone.8128': 'Dark Harvest', 'rune.keystone.8214': 'Summon Aery'
      , 'rune.keystone.8229': 'Arcane Comet', 'rune.keystone.8230': 'Phase Rush', 'rune.keystone.8437': 'Grasp of the Undying', 'rune.keystone.8439': 'Aftershock'
      , 'rune.keystone.8465': 'Guardian', 'rune.keystone.9923': 'Hail of Blades'
      , 'rune.style.8000': 'Precision', 'rune.style.8100': 'Domination', 'rune.style.8200': 'Sorcery', 'rune.style.8300': 'Inspiration', 'rune.style.8400': 'Resolve', 'rune.style.8500': 'Precision'
      , 'rune.shard.5001': 'Scaling Health', 'rune.shard.5005': 'Attack Speed', 'rune.shard.5007': 'Ability Haste', 'rune.shard.5008': 'Adaptive Force', 'rune.shard.5010': 'Move Speed', 'rune.shard.5011': 'Health', 'rune.shard.5013': 'Tenacity'
      , 'champions.noCandidates': 'No {title} recommendations available.', 'champions.runeSetCandidates': 'Rune set recommendations', 'champions.summonerSpellCandidates': 'Summoner spell recommendations'
      , 'champions.fetchUnavailable': 'Fetch is unavailable in this environment.', 'champions.statsApiFailed': 'Could not load Stats API data: {message}', 'champions.lanesUnavailable': 'Could not load available lanes.'
      , 'champions.championListFailed': 'Could not load champion list: {message}', 'champions.analysisRefreshFailed': 'Could not refresh analysis data: {message}', 'champions.matchupFailed': 'Could not load matchup data: {message}'
      , 'champions.matchupTimelineFailed': 'Could not load matchup timeline: {message}', 'champions.timelineFailed': 'Could not load timeline analysis: {message}', 'champions.detailsFailed': 'Could not load champion details: {message}'
      , 'champions.chart.globalVsUser': 'Comparison of global and your averages for {label}', 'champions.chart.through20': '{label} through 20 min. Positive values favor the champion; negative values favor the opponent.'
      , 'champions.chart.minute': '{minute} min', 'champions.chart.you': 'You {value}', 'champions.chart.games': 'Games {games}', 'champions.chart.champion': 'Champion {value}', 'champions.chart.opponent': 'Opponent {value}'
      , 'champions.chart.timelineAria': 'Timeline of {label} for champion and opponent', 'champions.chart.global': 'Global', 'champions.chart.yourAverage': 'Your average', 'champions.chart.plateTimeline': 'Lane plate differential through 20 min'
      , 'champions.chart.plateCount': '{value} plates', 'champions.chart.plateNet': 'Plate differential {value}', 'champions.detailsTable': 'Detailed data (table)', 'champions.clickToShow': 'Click to show', 'champions.clickToHide': 'Click to hide'
      , 'champions.timelineNote': 'Lead rate is the share of games where the champion was ahead of the opponent at that point. Games only include matches that reached that point.', 'champions.backToMatchups': '← Back to matchups'
      , 'champions.vsOpponent': '{champion} versus {opponent}', 'champions.firstSecondCore': '1st + 2nd core', 'champions.core': 'Core'
      , 'champions.thirdItem': '3rd item', 'champions.fourthItem': '4th item', 'champions.fifthItem': '5th item', 'champions.sixthItem': '6th item', 'champions.activeKeystoneRunes': 'Common setup for the active keystone'
      , 'champions.keystoneSummoners': 'Summoner spell combinations used with this keystone', 'champions.itemBuildDescription': 'Representative options from start through sixth item', 'champions.skillOrderDescription': 'Levels 1–6 and the skill to prioritize'
      , 'champions.rateLimitedRetry': '{target} is rate limited. Retrying automatically in {seconds}s.', 'champions.metaInfo': 'Stats API metadata', 'champions.championList': 'Champion list'
      , 'champions.matrix.avgKa': 'Average K+A champion / opponent', 'champions.matrix.avgKda': 'Average K / D / A', 'champions.matrix.damageDealt': 'Damage dealt champion / opponent', 'champions.matrix.damageTaken': 'Damage taken champion / opponent', 'champions.matrix.ccTime': 'CC seconds champion / opponent', 'champions.matrix.plates': 'Plates taken / lost', 'champions.matrix.outerTower': 'Outer tower taken / lost'
      , 'champions.jungleParticipationDescription': 'Total kills + assists: your jungler − opposing jungler', 'champions.jungleParticipationDetail': 'Your jungle K+A {champion} / opponent jungle K+A {opponent}', 'champions.jungleParticipation': 'Jungle kill participation difference', 'champions.duoCombat': '2v2 combat difference', 'champions.soloCombatDescription': 'Solo kills − solo deaths', 'champions.soloCombat': 'Solo combat difference'
      , 'champions.rateLimitRetry': 'Retry in {seconds}s.', 'champions.retryLater': 'Please try again shortly.', 'champions.rateLimitReached': 'Rate limit reached. {retry}', 'champions.serverError': 'Stats API server error ({status}).', 'champions.seconds': '{value}s'
      , 'timeline.goldDifference': 'Gold difference', 'timeline.xpDifference': 'XP difference', 'timeline.csDifference': 'CS difference', 'timeline.overallDifference': 'Overall difference', 'timeline.overallLeadRate': 'Overall lead rate', 'timeline.yourDifference': 'Your difference', 'timeline.yourAverage': 'Your average', 'timeline.leadRate': 'Lead rate {value}', 'timeline.through20': '{label} (through 20 min)', 'timeline.combatImpact': 'Combat impact', 'timeline.champion': 'Champion', 'timeline.opponent': 'Opponent', 'timeline.advantageDirection': '+ champion advantage / − opponent advantage', 'timeline.championDamage': 'Champion damage', 'timeline.damageTaken': 'Damage taken', 'timeline.enemyCcDuration': 'Enemy CC duration', 'timeline.plateDifference': 'Plate difference (through 20 min)', 'timeline.goldLead': 'Gold lead', 'timeline.xpLead': 'XP lead', 'timeline.csLead': 'CS lead', 'timeline.laneCombatDifference': 'Lane combat difference'
    },
    ja: {
      'settings.installDirectory': 'インストールディレクトリ',
      'window.controls': 'ウィンドウ操作', 'window.minimize': '最小化', 'window.close': '閉じる', 'window.viewSwitcher': '画面切り替え',
      'header.matchData': '5v5 SR 試合データ', 'header.downloadRecent': '直近の試合を取得', 'header.downloadSeason': '今シーズンの試合を取得',
      'nav.draft': 'Draft', 'nav.pool': 'ChampionPool', 'nav.champions': 'Champions', 'nav.stats': 'Stats', 'nav.settings': 'Settings',
      'home.client': 'League Client', 'home.launch': 'League of Legends を起動してください', 'home.loginHelp': 'ログインすると、この画面にドラフト支援の使い方が表示されます。', 'home.connectionHelp': 'League of Legends 起動後も画面が変わらない場合は、設定のインストールディレクトリを確認してください。',
      'home.ready': '準備完了', 'home.readyToDraft': 'ドラフトを開始できます。', 'home.addPool': 'チャンピオンプールにロールごとのチャンピオンを追加します。', 'home.startDraft': 'サモナーズリフトのドラフトを開始します。', 'home.draftHelp': 'チャンピオン選択が始まると、この画面は自動で切り替わり、BAN/PICK候補とおすすめビルドを表示します。', 'home.otherFeatures': 'その他の機能', 'home.championsHelp': 'チャンピオンごとのビルド、ルーン、優先スキル、対面データを確認できます。', 'home.statsHelp': '使用チャンピオンとレーン対面の戦績を確認できます。',
      'home.unsupported': '未対応モード', 'home.unsupportedTitle': '未対応のゲームモードです', 'home.unsupportedHelp': 'ドラフト支援はサモナーズリフトのドラフト、ランク、カスタムドラフト、トーナメントドラフトで利用できます。', 'home.currentGame': '現在の試合', 'home.nextDraft': 'この試合終了後、次のドラフトを監視します。',
      'draft.allyBans': '味方BAN', 'draft.pick': 'ドラフト', 'draft.championSelect': 'チャンピオン選択', 'draft.enemyBans': '敵BAN', 'draft.yourTeam': '味方チーム', 'draft.currentState': '現在の状態', 'draft.enemyTeam': '敵チーム', 'pool.empty': 'チャンピオンがまだ追加されていません。',
      'static.patch': 'パッチ', 'static.region': '地域', 'static.rank': 'ランク', 'static.lane': 'レーン', 'static.allRanks': '全ランク', 'static.loadingMetadata': 'Stats API のメタ情報を取得中です。', 'static.tier': 'ティア', 'static.champion': 'チャンピオン', 'static.games': '試合数', 'static.pickRate': 'PICK率', 'static.banRate': 'BAN率', 'static.championDetails': 'チャンピオン詳細', 'static.playedChampions': '使用チャンピオン', 'static.laneOpponents': 'レーン対面', 'static.minGames': '最小試合数', 'static.playedStatistics': '使用チャンピオンの戦績', 'static.winRate': '勝率', 'static.laneOpponentStatistics': 'レーン対面の戦績', 'static.matchups': '対面数', 'static.yourKda': 'あなたのK/D/A', 'settings.matchV5Route': 'Match-V5 リージョナルルート',
      'window.laneSwitcher': 'レーン切り替え', 'window.statsSwitcher': '戦績切り替え', 'window.backToChampions': 'チャンピオン一覧へ戻る',
      'static.noData': 'データなし', 'static.noMatchData': '試合データが取得されていません。', 'static.hello': 'こんにちは', 'static.waiting': '待機中',
      'settings.browse': '参照',
      'settings.save': '保存',
      'settings.routeHelp': 'LoLログイン後に LCU から自動検出します。',
      'settings.theme': '表示テーマ',
      'settings.theme.system': 'システムと同期',
      'settings.theme.light': 'ライト',
      'settings.theme.dark': 'ダーク',
      'settings.theme.systemHelp': 'OSの表示モードに合わせます。',
      'settings.language': '言語',
      'settings.savedAndReconnecting': '保存しました。接続状態を再確認しています。',
      'settings.saveFailed': '保存できませんでした: {message}',
      'settings.themeSaved': '表示テーマを保存しました。',
      'settings.languageSaved': '言語設定を保存しました。',
      'settings.detectedRoute': 'LCUから自動検出したサーバ: {platformRegion} / Match-V5 route: {regionalRoute}',
      'settings.waitingForRoute': 'LoLログイン後に LCU から自動検出します。'
      , 'champions.search': 'チャンピオン名で検索'
      , 'champions.none': '指定なし'
      , 'champions.opponent': '対面チャンピオン'
      , 'champions.opponentSearch': '対面チャンピオンを検索'
      , 'champions.build': 'ビルド'
      , 'champions.timeline': 'タイムライン分析'
      , 'champions.matchups': 'マッチアップ分析'
      , 'champions.keystone': 'キーストーン'
      , 'champions.selectKeystone': 'キーストーンを選択してください'
      , 'champions.runeSets': 'ルーンセット'
      , 'champions.summonerSpells': 'サモナースペル'
      , 'champions.runeShards': 'ルーンシャード'
      , 'champions.startingItems': 'スタートアイテム'
      , 'champions.boots': 'ブーツ'
      , 'champions.itemBuild': 'アイテムビルド'
      , 'champions.skillOrder': 'スキルオーダー'
      , 'champions.skillPriority': '優先スキル'
      , 'champions.start': '開始'
      , 'matchData.none': '試合データが取得されていません'
      , 'matchData.unknownPeriod': '期間不明'
      , 'stats.noOpponentData': '条件に合う対面データがありません。'
      , 'stats.noPlayedData': '条件に合うチャンピオン実績がありません。'
      , 'draft.noRunes': 'ルーン候補がありません。'
      , 'draft.noSummonerSpells': 'サモナースペル候補がありません。'
      , 'draft.runeSets': 'ルーンセット'
      , 'draft.summonerSpells': 'サモナースペル'
      , 'draft.loadingRecommendations': 'StatsAPI からおすすめを取得中です。'
      , 'draft.recommendationsUnavailable': 'おすすめを取得できませんでした。'
      , 'draft.noRecommendations': 'おすすめデータがありません。'
      , 'draft.analysis.title': 'バンピック分析'
      , 'draft.analysis.finalTitle': '最終構成分析'
      , 'draft.analysis.loading': 'AIに分析を依頼中・・'
      , 'draft.analysis.finalLoading': 'AIに最終構成を分析依頼中・・'
      , 'draft.analysis.waiting': 'AI分析を待機中・・'
      , 'draft.analysis.unavailable': 'AI分析を表示できませんでした。'
      , 'draft.analysis.noBans': 'BANなし'
      , 'draft.action.yourBan': 'あなたのBANです'
      , 'draft.action.yourPick': 'あなたのPICKです'
      , 'draft.action.waiting': '待機中'
      , 'draft.plannedPick': '{champion} を予定'
      , 'draft.pickPending': 'PICK予定'
      , 'draft.matchup.loadingCounters': 'StatsAPIからカウンター候補を取得中です。'
      , 'draft.matchup.loadingAdvantage': 'StatsAPIから有利候補を取得中です。'
      , 'draft.matchup.unavailable': 'カウンター候補を取得できませんでした。'
      , 'draft.matchup.noData': '対象データがありません（{minGames}+ games）'
      , 'draft.matchup.winRate': 'WR'
      , 'inGame.noCandidates': '候補なし'
      , 'inGame.recommendationPending': 'チャンピオンとロールが確定したら、おすすめビルドとスキルオーダーを表示します。'
      , 'inGame.skillPending': 'チャンピオンとロールが確定したら、スキルオーダーを表示します。'
      , 'inGame.matchupPending': '同じレーンの相手チャンピオン確定後に取得します。'
      , 'inGame.loadingRecommendations': 'StatsAPI からおすすめを取得中です。'
      , 'inGame.recommendationsUnavailable': 'おすすめを取得できませんでした。'
      , 'inGame.noRecommendationData': 'おすすめデータがありません。'
      , 'inGame.recommendationTabs': '推奨表示の切り替え'
      , 'inGame.skillPriority': '優先スキル'
      , 'inGame.title': '試合中です'
      , 'inGame.opponent': '相手'
      , 'inGame.pickMemo': 'ドラフト情報が取得できた試合では、ここに今回のピックメモを表示します。'
      , 'inGame.final.loading': 'AIに最終構成を分析依頼中・・'
      , 'inGame.final.waiting': '最終構成分析を待機中・・'
      , 'inGame.final.unavailable': 'AI分析を表示できませんでした。'
      , 'inGame.lane.loading': 'AIにレーン対面分析を依頼中...'
      , 'inGame.lane.waiting': 'GameStart / InProgress の対面情報を待っています。'
      , 'inGame.lane.unavailable': 'AI対面分析を取得できませんでした。'
      , 'stats.noMatchingPicks': '該当するピックはありません。'
      , 'stats.winningPicks': '勝ち越しが多い自分ピック'
      , 'stats.losingPicks': '負け越しが多い自分ピック'
      , 'stats.strongMatchups': '得意な対面'
      , 'stats.weakMatchups': '苦手な対面'
      , 'pool.noMatchingChampions': '一致するチャンピオンがありません。'
      , 'pool.waitingForChampions': 'LCU接続後にチャンピオン一覧を取得します。'
      , 'pool.saved': 'チャンピオンプールを保存しました。'
      , 'pool.saveFailed': '保存できませんでした: {message}'
      , 'pool.alreadySelected': '{champion} は登録済みです'
      , 'pool.removeChampion': '{champion} を削除'
      , 'stats.showPicksAgainst': '{champion} に対する自分ピックを表示'
      , 'stats.showMatchupsFor': '{champion} の対面別成績を表示'
      , 'common.statsApiUnavailable': 'StatsAPI request helper が利用できません。'
      , 'common.statsApiLoadFailed': 'StatsAPIを取得できませんでした。'
      , 'common.noSkillRecommendations': 'スキル候補がありません。'
      , 'home.unselected': '未選択'
      , 'home.noMatchData': '条件に合う試合データがありません。'
      , 'home.noLaneData': '条件に合う対面データがありません。'
      , 'home.noChampionResults': '条件に合うチャンピオン実績がありません。'
      , 'home.noPickResults': '自分のピック実績なし'
      , 'home.weakPicks': '苦手だったピック'
      , 'home.strongPicks': '勝てているピック'
      , 'home.aiUnavailable': 'AI分析を取得できませんでした。'
      , 'champions.noMatchingChampions': '条件に合うチャンピオンがありません。'
      , 'champions.noSearchResults': '検索条件に合うチャンピオンがありません。'
      , 'champions.noMatchupData': 'この条件では対面データがありません。'
      , 'champions.noMinimumMatchups': '最小試合数を満たす対面がありません。'
      , 'champions.noTimelineData': 'この条件では時間推移データがありません。'
      , 'champions.noSnapshots': '通常スナップショットがある試合がありません。'
      , 'champions.analysisMenu': 'チャンピオン分析メニュー'
      , 'champions.sortBy': '{label}で並べ替え'
      , 'champions.refresh': '更新'
      , 'champions.loading': '取得中'
      , 'champions.details': '詳細'
      , 'champions.noRecommendations': '候補がありません。'
      , 'champions.noKeystoneDetails': '表示できるキーストーン詳細がありません。'
      , 'champions.noKeystoneOptions': 'キーストーン候補がありません。'
      , 'champions.noBuildData': 'この条件ではビルドデータがありません。'
      , 'window.restore': '元に戻す'
      , 'window.maximize': '最大化'
      , 'draft.greeting': 'こんにちは {name}'
      , 'ai.noDisplay': 'AI分析を表示できませんでした。'
      , 'ai.rateLimited': 'AI分析のリクエストが混み合っています。少し待ってから再度お試しください。'
      , 'ai.insufficientDraft': 'AI分析に必要なドラフト情報が不足しています。'
      , 'ai.unavailable': 'AI分析を取得できませんでした。'
      , 'season.title': 'シーズン中の全試合データ取得'
      , 'season.eyebrow': '試合データ'
      , 'season.description': '今シーズンの試合データをまとめて取得し、BAN / PICK 分析のサンプル数を増やします。'
      , 'season.estimatedTime': '予想時間'
      , 'season.totalMatches': '対象試合'
      , 'season.notDownloaded': '未取得'
      , 'season.note': '試合数によっては時間がかかります。取得中もアプリはそのまま利用できます。'
      , 'season.cancel': 'キャンセル'
      , 'season.startDownload': '取得を開始'
      , 'season.matches': '試合'
      , 'rune.keystone.8005': 'プレスアタック', 'rune.keystone.8008': 'リーサルテンポ', 'rune.keystone.8010': '征服者', 'rune.keystone.8021': 'フリートフットワーク'
      , 'rune.keystone.8112': '電撃', 'rune.keystone.8124': '捕食者', 'rune.keystone.8128': 'ダークハーベスト', 'rune.keystone.8214': 'エアリー'
      , 'rune.keystone.8229': '秘儀の彗星', 'rune.keystone.8230': 'フェイズラッシュ', 'rune.keystone.8437': '不死者の握撃', 'rune.keystone.8439': 'アフターショック'
      , 'rune.keystone.8465': 'ガーディアン', 'rune.keystone.9923': 'ヘイルブレード'
      , 'rune.style.8000': '栄華', 'rune.style.8100': '覇道', 'rune.style.8200': '魔道', 'rune.style.8300': '天啓', 'rune.style.8400': '不滅', 'rune.style.8500': '栄華'
      , 'rune.shard.5001': 'スケーリング体力', 'rune.shard.5005': '攻撃速度', 'rune.shard.5007': 'スキルヘイスト', 'rune.shard.5008': 'アダプティブフォース', 'rune.shard.5010': '移動速度', 'rune.shard.5011': '体力', 'rune.shard.5013': '行動妨害耐性'
      , 'champions.noCandidates': '{title}候補がありません。', 'champions.runeSetCandidates': 'ルーンセット候補', 'champions.summonerSpellCandidates': 'サモナースペル候補'
      , 'champions.fetchUnavailable': 'この環境ではfetchを利用できません。', 'champions.statsApiFailed': 'StatsAPIを取得できませんでした: {message}', 'champions.lanesUnavailable': '利用可能なLaneが取得できませんでした。'
      , 'champions.championListFailed': 'チャンピオン一覧を取得できませんでした: {message}', 'champions.analysisRefreshFailed': '分析データを更新できませんでした: {message}', 'champions.matchupFailed': '対面データを取得できませんでした: {message}'
      , 'champions.matchupTimelineFailed': '対面推移を取得できませんでした: {message}', 'champions.timelineFailed': 'タイムライン分析を取得できませんでした: {message}', 'champions.detailsFailed': 'チャンピオン詳細を取得できませんでした: {message}'
      , 'champions.chart.globalVsUser': '{label}の全体平均とユーザー平均の比較', 'champions.chart.through20': '20分までの{label}。正値は対象チャンピオン優勢、負値は対面チャンピオン優勢'
      , 'champions.chart.minute': '{minute}分', 'champions.chart.you': 'あなた {value}', 'champions.chart.games': '試合数 {games}試合', 'champions.chart.champion': '対象 {value}', 'champions.chart.opponent': '対面 {value}'
      , 'champions.chart.timelineAria': '{label}の対象チャンピオンと対面チャンピオンの時間推移', 'champions.chart.global': '全体', 'champions.chart.yourAverage': 'あなたの平均', 'champions.chart.plateTimeline': '20分までのレーンプレート収支の時間推移'
      , 'champions.chart.plateCount': '{value}枚', 'champions.chart.plateNet': 'プレート収支 {value}枚', 'champions.detailsTable': '詳細データ（表）', 'champions.clickToShow': 'クリックで表示', 'champions.clickToHide': 'クリックで閉じる'
      , 'champions.timelineNote': 'リード率は、その時点で対象チャンピオンの値が対面を上回った試合の割合です。試合数はその時点まで継続した試合のみを数えます。', 'champions.backToMatchups': '← 対面一覧に戻る'
      , 'champions.vsOpponent': '{champion} 対 {opponent}', 'champions.firstSecondCore': '1st + 2nd コア', 'champions.core': 'コア'
      , 'champions.thirdItem': '3rd アイテム', 'champions.fourthItem': '4th アイテム', 'champions.fifthItem': '5th アイテム', 'champions.sixthItem': '6th アイテム', 'champions.activeKeystoneRunes': 'アクティブなキーストーンでよく使われる構成'
      , 'champions.keystoneSummoners': 'このキーストーンと一緒に使われる組み合わせ', 'champions.itemBuildDescription': '開始から 6th までの代表候補', 'champions.skillOrderDescription': 'Lv1-6 の取り方と優先して伸ばすスキル'
      , 'champions.rateLimitedRetry': '{target}はレート制限中です。{seconds}秒後に自動再試行します。', 'champions.metaInfo': 'StatsAPIのメタ情報', 'champions.championList': 'チャンピオン一覧'
      , 'champions.matrix.avgKa': '平均 K+A 対象 / 対面', 'champions.matrix.avgKda': '平均 K / D / A', 'champions.matrix.damageDealt': '与ダメ 対象 / 対面', 'champions.matrix.damageTaken': '被ダメ 対象 / 対面', 'champions.matrix.ccTime': 'CC秒 対象 / 対面', 'champions.matrix.plates': 'プレート 取得 / 喪失', 'champions.matrix.outerTower': 'アウタータワー 取得 / 喪失'
      , 'champions.jungleParticipationDescription': '全Kill + Assist: 自JG − 相手JG', 'champions.jungleParticipationDetail': '自JG K+A {champion} / 相手JG K+A {opponent}', 'champions.jungleParticipation': 'JGキル関与数差', 'champions.duoCombat': '2v2キル収支', 'champions.soloCombatDescription': 'ソロKill − ソロDeath', 'champions.soloCombat': 'ソロキル収支'
      , 'champions.rateLimitRetry': '{seconds}秒後に再試行できます。', 'champions.retryLater': '少し待ってから再試行してください。', 'champions.rateLimitReached': 'レート制限に達しました。{retry}', 'champions.serverError': 'StatsAPIサーバーでエラーが発生しました ({status})。', 'champions.seconds': '{value}秒'
      , 'timeline.goldDifference': 'ゴールド差', 'timeline.xpDifference': '経験値差', 'timeline.csDifference': 'CS差', 'timeline.overallDifference': '全体の差分', 'timeline.overallLeadRate': '全体のリード率', 'timeline.yourDifference': 'あなたの差分', 'timeline.yourAverage': 'あなたの平均', 'timeline.leadRate': 'リード率 {value}', 'timeline.through20': '{label}（20分まで）', 'timeline.combatImpact': '戦闘インパクト', 'timeline.champion': '対象チャンピオン', 'timeline.opponent': '対面チャンピオン', 'timeline.advantageDirection': '+ 対象チャンピオン優勢 / − 対面チャンピオン優勢', 'timeline.championDamage': 'チャンピオンへの与ダメージ', 'timeline.damageTaken': '被ダメージ', 'timeline.enemyCcDuration': '敵へのCC時間', 'timeline.plateDifference': 'レーンプレート収支（20分まで）', 'timeline.goldLead': 'ゴールドリード', 'timeline.xpLead': '経験値リード', 'timeline.csLead': 'CSリード', 'timeline.laneCombatDifference': 'レーン戦闘差'
    },
    get kr(): Record<string, string> { return koreanMessages; }
  };

  const koreanMessages: Record<string, string> = {
    'settings.installDirectory': '설치 디렉터리', 'window.controls': '창 제어', 'window.minimize': '최소화', 'window.close': '닫기', 'window.viewSwitcher': '화면 전환',
    'header.matchData': '5v5 SR 경기 데이터', 'header.downloadRecent': '최근 경기 다운로드', 'header.downloadSeason': '이번 시즌 경기 다운로드',
    'nav.draft': 'Draft', 'nav.pool': 'ChampionPool', 'nav.champions': 'Champions', 'nav.stats': 'Stats', 'nav.settings': 'Settings',
    'home.client': '리그 클라이언트', 'home.launch': 'League of Legends를 실행하세요', 'home.loginHelp': '로그인하면 이 화면에 드래프트 도우미 사용 방법이 표시됩니다.', 'home.connectionHelp': '게임 실행 후에도 화면이 바뀌지 않으면 설정에서 설치 디렉터리를 확인하세요.',
    'home.ready': '준비 완료', 'home.readyToDraft': '드래프트를 시작할 준비가 되었습니다.', 'home.addPool': 'ChampionPool에 역할별 챔피언을 추가하세요.', 'home.startDraft': '소환사의 협곡 드래프트를 시작하세요.', 'home.draftHelp': '챔피언 선택이 시작되면 이 화면이 자동으로 전환되어 밴/픽 후보와 추천 빌드를 표시합니다.', 'home.otherFeatures': '기타 기능', 'home.championsHelp': '챔피언별 빌드, 룬, 스킬 우선순위, 상성 데이터를 확인하세요.', 'home.statsHelp': '플레이한 챔피언과 라인 상대 전적을 확인하세요.',
    'home.unsupported': '지원하지 않는 모드', 'home.unsupportedTitle': '지원하지 않는 게임 모드가 활성화되어 있습니다', 'home.unsupportedHelp': '드래프트 지원은 소환사의 협곡 드래프트, 랭크, 사용자 설정 드래프트 및 토너먼트 드래프트에서 사용할 수 있습니다.', 'home.currentGame': '현재 게임', 'home.nextDraft': '이 게임이 끝나면 다음 드래프트를 모니터링합니다.',
    'draft.allyBans': '아군 밴', 'draft.pick': '드래프트 픽', 'draft.championSelect': '챔피언 선택', 'draft.enemyBans': '적 밴', 'draft.yourTeam': '우리 팀', 'draft.currentState': '현재 상태', 'draft.enemyTeam': '적 팀',
    'static.patch': '패치', 'static.region': '지역', 'static.rank': '티어', 'static.lane': '라인', 'static.allRanks': '모든 티어', 'static.loadingMetadata': 'Stats API 메타데이터를 불러오는 중입니다.', 'static.tier': '티어', 'static.champion': '챔피언', 'static.games': '게임', 'static.pickRate': '픽률', 'static.banRate': '밴률', 'static.championDetails': '챔피언 상세', 'static.playedChampions': '플레이한 챔피언', 'static.laneOpponents': '라인 상대', 'static.minGames': '최소 게임', 'static.playedStatistics': '플레이한 챔피언 통계', 'static.winRate': '승률', 'static.laneOpponentStatistics': '라인 상대 통계', 'static.matchups': '상성', 'static.yourKda': '내 K/D/A',
    'static.noData': '데이터 없음', 'static.noMatchData': '다운로드한 경기 데이터가 없습니다.', 'static.hello': '안녕하세요', 'static.waiting': '대기 중',
    'settings.matchV5Route': 'Match-V5 리전 경로', 'champions.boots': '신발',
    'settings.browse': '찾아보기', 'settings.save': '저장', 'settings.routeHelp': 'League of Legends 로그인 후 LCU에서 자동으로 감지됩니다.', 'settings.theme': '테마', 'settings.theme.system': '시스템', 'settings.theme.light': '라이트', 'settings.theme.dark': '다크', 'settings.theme.systemHelp': '운영체제 모양에 맞춥니다.', 'settings.language': '언어', 'settings.savedAndReconnecting': '저장되었습니다. 연결 상태를 다시 확인합니다.', 'settings.saveFailed': '저장할 수 없습니다: {message}', 'settings.themeSaved': '테마 설정이 저장되었습니다.', 'settings.languageSaved': '언어 설정이 저장되었습니다.', 'settings.detectedRoute': 'LCU에서 감지한 서버: {platformRegion} / Match-V5 경로: {regionalRoute}', 'settings.waitingForRoute': 'League of Legends 로그인 후 LCU에서 자동으로 감지됩니다.',
    'champions.search': '챔피언 검색', 'champions.none': '없음', 'champions.opponent': '라인 상대', 'champions.opponentSearch': '라인 상대 검색', 'champions.build': '빌드', 'champions.timeline': '시간대 분석', 'champions.matchups': '상성 분석', 'champions.keystone': '핵심 룬', 'champions.selectKeystone': '핵심 룬 선택', 'champions.runeSets': '룬 세트', 'champions.summonerSpells': '소환사 주문', 'champions.runeShards': '룬 파편', 'champions.startingItems': '시작 아이템', 'champions.itemBuild': '아이템 빌드', 'champions.skillOrder': '스킬 순서', 'champions.skillPriority': '스킬 우선순위', 'champions.start': '시작',
    'draft.noRunes': '추천 룬이 없습니다.', 'draft.noSummonerSpells': '추천 소환사 주문이 없습니다.', 'draft.runeSets': '룬 세트', 'draft.summonerSpells': '소환사 주문', 'draft.loadingRecommendations': 'Stats API에서 추천을 불러오는 중입니다.', 'draft.recommendationsUnavailable': '추천을 불러올 수 없습니다.', 'draft.noRecommendations': '추천 데이터가 없습니다.', 'draft.analysis.title': '밴/픽 분석', 'draft.analysis.finalTitle': '최종 조합 분석', 'draft.analysis.loading': 'AI 분석을 요청하는 중…', 'draft.analysis.finalLoading': '최종 조합 분석을 요청하는 중…', 'draft.analysis.waiting': 'AI 분석을 기다리는 중…', 'draft.analysis.unavailable': 'AI 분석을 표시할 수 없습니다.', 'draft.analysis.noBans': '밴 없음', 'draft.action.yourBan': '내 밴', 'draft.action.yourPick': '내 픽', 'draft.action.waiting': '대기 중', 'draft.plannedPick': '{champion} 선택 예정', 'draft.pickPending': '픽 대기 중',
    'draft.matchup.loadingCounters': 'Stats API에서 카운터 추천을 불러오는 중입니다.', 'draft.matchup.loadingAdvantage': 'Stats API에서 유리한 추천을 불러오는 중입니다.', 'draft.matchup.unavailable': '상성 추천을 불러올 수 없습니다.', 'draft.matchup.noData': '사용 가능한 데이터가 없습니다 ({minGames}게임 이상)', 'draft.matchup.winRate': 'WR',
    'inGame.noCandidates': '추천 없음', 'inGame.recommendationPending': '챔피언과 역할이 확정되면 추천 빌드와 스킬 순서가 표시됩니다.', 'inGame.skillPending': '챔피언과 역할이 확정되면 스킬 순서가 표시됩니다.', 'inGame.matchupPending': '상대 라인 챔피언이 확정되면 사용할 수 있습니다.', 'inGame.loadingRecommendations': 'Stats API에서 추천을 불러오는 중입니다.', 'inGame.recommendationsUnavailable': '추천을 불러올 수 없습니다.', 'inGame.noRecommendationData': '추천 데이터가 없습니다.', 'inGame.recommendationTabs': '추천 보기 전환', 'inGame.skillPriority': '스킬 우선순위', 'inGame.title': '게임 중', 'inGame.opponent': '상대', 'inGame.pickMemo': '드래프트 정보를 사용할 수 있으면 내 픽 메모가 여기에 표시됩니다.', 'inGame.final.loading': '최종 조합 분석을 요청하는 중…', 'inGame.final.waiting': '최종 조합 분석을 기다리는 중…', 'inGame.final.unavailable': 'AI 분석을 표시할 수 없습니다.', 'inGame.lane.loading': '라인 상성 분석을 요청하는 중…', 'inGame.lane.waiting': 'GameStart / InProgress의 라인 상성 정보를 기다리는 중입니다.', 'inGame.lane.unavailable': '라인 상성 분석을 불러올 수 없습니다.',
    'pool.empty': '아직 추가한 챔피언이 없습니다.', 'pool.noMatchingChampions': '일치하는 챔피언을 찾을 수 없습니다.', 'pool.waitingForChampions': 'League Client에 연결하면 챔피언 목록을 불러옵니다.', 'pool.saved': '챔피언 풀이 저장되었습니다.', 'pool.saveFailed': '저장할 수 없습니다: {message}', 'pool.alreadySelected': '{champion}은(는) 이미 챔피언 풀에 있습니다.', 'pool.removeChampion': '{champion} 제거',
    'stats.noOpponentData': '선택한 필터에 맞는 라인 상대 데이터가 없습니다.', 'stats.noPlayedData': '선택한 필터에 맞는 플레이한 챔피언 결과가 없습니다.', 'stats.noMatchingPicks': '일치하는 픽이 없습니다.', 'stats.winningPicks': '승리한 픽', 'stats.losingPicks': '패배한 픽', 'stats.strongMatchups': '강한 상성', 'stats.weakMatchups': '약한 상성',
    'common.statsApiUnavailable': 'Stats API 요청 도우미를 사용할 수 없습니다.', 'common.statsApiLoadFailed': 'Stats API 데이터를 불러올 수 없습니다.', 'common.noSkillRecommendations': '추천 스킬이 없습니다.',
    'season.title': '시즌 전체 경기 데이터 다운로드', 'season.eyebrow': '경기 데이터', 'season.description': '이번 시즌 경기 데이터를 다운로드하여 밴/픽 분석의 표본 수를 늘립니다.', 'season.estimatedTime': '예상 시간', 'season.totalMatches': '전체 경기', 'season.notDownloaded': '다운로드하지 않음', 'season.note': '경기 수에 따라 시간이 걸릴 수 있습니다. 다운로드 중에도 앱을 계속 사용할 수 있습니다.', 'season.cancel': '취소', 'season.startDownload': '다운로드 시작', 'season.matches': '게임',
    'timeline.goldDifference': '골드 차이', 'timeline.xpDifference': '경험치 차이', 'timeline.csDifference': 'CS 차이', 'timeline.overallDifference': '전체 차이', 'timeline.overallLeadRate': '전체 리드율', 'timeline.yourDifference': '내 차이', 'timeline.yourAverage': '내 평균', 'timeline.leadRate': '리드율 {value}', 'timeline.through20': '{label} (20분까지)', 'timeline.combatImpact': '전투 영향', 'timeline.champion': '챔피언', 'timeline.opponent': '상대', 'timeline.advantageDirection': '+ 챔피언 우세 / − 상대 우세', 'timeline.championDamage': '챔피언 피해량', 'timeline.damageTaken': '받은 피해량', 'timeline.enemyCcDuration': '적 CC 지속 시간', 'timeline.plateDifference': '플레이트 차이 (20분까지)', 'timeline.goldLead': '골드 리드', 'timeline.xpLead': '경험치 리드', 'timeline.csLead': 'CS 리드', 'timeline.laneCombatDifference': '라인 전투 차이',
    'window.laneSwitcher': '라인 전환', 'window.statsSwitcher': '통계 전환', 'window.backToChampions': '챔피언 목록으로 돌아가기', 'window.restore': '창 복원', 'window.maximize': '창 최대화',
    'matchData.none': '다운로드한 경기 데이터가 없습니다.', 'matchData.unknownPeriod': '알 수 없는 기간',
    'home.unselected': '선택되지 않음', 'home.noMatchData': '일치하는 경기 데이터가 없습니다.', 'home.noLaneData': '일치하는 라인 데이터가 없습니다.', 'home.noChampionResults': '일치하는 챔피언 결과가 없습니다.', 'home.noPickResults': '픽 결과가 없습니다.', 'home.weakPicks': '약한 픽', 'home.strongPicks': '강한 픽', 'home.aiUnavailable': 'AI 분석을 불러올 수 없습니다.',
    'stats.showPicksAgainst': '{champion} 상대 픽 보기', 'stats.showMatchupsFor': '{champion} 상성 결과 보기',
    'champions.noMatchingChampions': '선택한 필터에 맞는 챔피언이 없습니다.', 'champions.noSearchResults': '검색어와 일치하는 챔피언이 없습니다.', 'champions.noMatchupData': '이 필터에 맞는 상성 데이터가 없습니다.', 'champions.noMinimumMatchups': '최소 게임 수를 충족하는 상성이 없습니다.', 'champions.noTimelineData': '이 필터에 맞는 시간대 데이터가 없습니다.', 'champions.noSnapshots': '일반 타임라인 스냅샷이 있는 경기가 없습니다.', 'champions.analysisMenu': '챔피언 분석 메뉴', 'champions.sortBy': '{label} 기준 정렬', 'champions.refresh': '새로고침', 'champions.loading': '불러오는 중', 'champions.details': '상세', 'champions.noRecommendations': '추천이 없습니다.', 'champions.noKeystoneDetails': '핵심 룬 상세가 없습니다.', 'champions.noKeystoneOptions': '핵심 룬 선택지가 없습니다.', 'champions.noBuildData': '이 필터에 맞는 빌드 데이터가 없습니다.',
    'champions.noCandidates': '{title} 추천이 없습니다.', 'champions.runeSetCandidates': '룬 세트 추천', 'champions.summonerSpellCandidates': '소환사 주문 추천', 'champions.fetchUnavailable': '이 환경에서는 Fetch를 사용할 수 없습니다.', 'champions.statsApiFailed': 'Stats API 데이터를 불러올 수 없습니다: {message}', 'champions.lanesUnavailable': '사용 가능한 라인을 불러올 수 없습니다.', 'champions.championListFailed': '챔피언 목록을 불러올 수 없습니다: {message}', 'champions.analysisRefreshFailed': '분석 데이터를 새로고침할 수 없습니다: {message}', 'champions.matchupFailed': '상성 데이터를 불러올 수 없습니다: {message}', 'champions.matchupTimelineFailed': '상성 타임라인을 불러올 수 없습니다: {message}', 'champions.timelineFailed': '시간대 분석을 불러올 수 없습니다: {message}', 'champions.detailsFailed': '챔피언 상세를 불러올 수 없습니다: {message}',
    'champions.chart.globalVsUser': '{label}의 전체 평균과 내 평균 비교', 'champions.chart.through20': '{label} (20분까지). 양수는 챔피언 우세, 음수는 상대 우세입니다.', 'champions.chart.minute': '{minute}분', 'champions.chart.you': '나 {value}', 'champions.chart.games': '게임 {games}', 'champions.chart.champion': '챔피언 {value}', 'champions.chart.opponent': '상대 {value}', 'champions.chart.timelineAria': '챔피언과 상대의 {label} 타임라인', 'champions.chart.global': '전체', 'champions.chart.yourAverage': '내 평균', 'champions.chart.plateTimeline': '20분까지 라인 플레이트 차이', 'champions.chart.plateCount': '플레이트 {value}', 'champions.chart.plateNet': '플레이트 차이 {value}', 'champions.detailsTable': '상세 데이터 (표)', 'champions.clickToShow': '클릭하여 표시', 'champions.clickToHide': '클릭하여 숨기기', 'champions.timelineNote': '리드율은 해당 시점에 챔피언이 상대보다 앞선 경기의 비율입니다. 게임 수에는 해당 시점까지 진행된 경기만 포함됩니다.', 'champions.backToMatchups': '← 상성 목록으로 돌아가기',
    'champions.vsOpponent': '{champion} 대 {opponent}', 'champions.firstSecondCore': '1·2코어', 'champions.core': '코어', 'champions.thirdItem': '3코어', 'champions.fourthItem': '4코어', 'champions.fifthItem': '5코어', 'champions.sixthItem': '6코어', 'champions.activeKeystoneRunes': '선택한 핵심 룬의 일반적인 세팅', 'champions.keystoneSummoners': '이 핵심 룬과 함께 쓰는 소환사 주문 조합', 'champions.itemBuildDescription': '시작 아이템부터 6코어까지의 대표 선택지', 'champions.skillOrderDescription': '레벨 1–6 스킬 순서와 우선 마스터 스킬', 'champions.rateLimitedRetry': '{target} 요청이 제한되었습니다. {seconds}초 후 자동으로 재시도합니다.', 'champions.metaInfo': 'Stats API 메타데이터', 'champions.championList': '챔피언 목록',
    'champions.matrix.avgKa': '평균 K+A 챔피언 / 상대', 'champions.matrix.avgKda': '평균 K / D / A', 'champions.matrix.damageDealt': '가한 피해량 챔피언 / 상대', 'champions.matrix.damageTaken': '받은 피해량 챔피언 / 상대', 'champions.matrix.ccTime': 'CC 시간(초) 챔피언 / 상대', 'champions.matrix.plates': '플레이트 획득 / 상실', 'champions.matrix.outerTower': '외곽 포탑 획득 / 상실', 'champions.jungleParticipationDescription': '총 킬 + 어시스트: 아군 정글 − 적 정글', 'champions.jungleParticipationDetail': '아군 정글 K+A {champion} / 적 정글 K+A {opponent}', 'champions.jungleParticipation': '정글 킬 관여 차이', 'champions.duoCombat': '2대2 전투 차이', 'champions.soloCombatDescription': '솔로 킬 − 솔로 데스', 'champions.soloCombat': '솔로 전투 차이', 'champions.rateLimitRetry': '{seconds}초 후 재시도할 수 있습니다.', 'champions.retryLater': '잠시 후 다시 시도하세요.', 'champions.rateLimitReached': '요청 제한에 도달했습니다. {retry}', 'champions.serverError': 'Stats API 서버 오류 ({status}).', 'champions.seconds': '{value}초',
    'ai.noDisplay': 'AI 분석을 표시할 수 없습니다.', 'ai.rateLimited': 'AI 분석 요청이 많습니다. 잠시 후 다시 시도하세요.', 'ai.insufficientDraft': 'AI 분석에 필요한 드래프트 정보가 부족합니다.', 'ai.unavailable': 'AI 분석을 불러올 수 없습니다.', 'draft.greeting': '안녕하세요, {name}',
    'rune.keystone.8005': '집중 공격', 'rune.keystone.8008': '치명적 속도', 'rune.keystone.8010': '정복자', 'rune.keystone.8021': '기민한 발놀림', 'rune.keystone.8112': '감전', 'rune.keystone.8124': '포식자', 'rune.keystone.8128': '어둠의 수확', 'rune.keystone.8214': '콩콩이 소환', 'rune.keystone.8229': '신비로운 유성', 'rune.keystone.8230': '난입', 'rune.keystone.8437': '착취의 손아귀', 'rune.keystone.8439': '여진', 'rune.keystone.8465': '수호자', 'rune.keystone.9923': '칼날비', 'rune.style.8000': '정밀', 'rune.style.8100': '지배', 'rune.style.8200': '마법', 'rune.style.8300': '영감', 'rune.style.8400': '결의', 'rune.style.8500': '정밀', 'rune.shard.5001': '체력 증가', 'rune.shard.5005': '공격 속도', 'rune.shard.5007': '스킬 가속', 'rune.shard.5008': '적응형 능력치', 'rune.shard.5010': '이동 속도', 'rune.shard.5011': '체력', 'rune.shard.5013': '강인함'
  };

  let currentLanguage: Language = DEFAULT_LANGUAGE;

  function normalizeLanguage(language: unknown): Language {
    return language === 'ja' || language === 'kr' || language === 'en' ? language : DEFAULT_LANGUAGE;
  }

  function getLanguage(): Language {
    return currentLanguage;
  }

  function getDataDragonLocale(): 'en_US' | 'ja_JP' | 'ko_KR' {
    if (currentLanguage === 'ja') return 'ja_JP';
    if (currentLanguage === 'kr') return 'ko_KR';
    return 'en_US';
  }

  function translate(key: string, values: TranslationValues = {}): string {
    const template = messages[currentLanguage][key] || messages[DEFAULT_LANGUAGE][key] || key;
    return template.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? `{${name}}`));
  }

  function getMissingTranslationKeys(language: Language, referenceLanguage: Language = DEFAULT_LANGUAGE): string[] {
    return Object.keys(messages[referenceLanguage]).filter((key) => !Object.prototype.hasOwnProperty.call(messages[language], key));
  }

  function applyStaticTranslations(doc: Document = root.document as Document): void {
    doc.documentElement.lang = currentLanguage;
    if (typeof doc.querySelectorAll !== 'function') return;
    doc.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      element.textContent = translate(element.dataset.i18n || '');
    });
    doc.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
      element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel || ''));
    });
    doc.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((element) => {
      element.placeholder = translate(element.dataset.i18nPlaceholder || '');
    });
  }

  function setLanguage(language: unknown, doc: Document = root.document as Document): Language {
    currentLanguage = normalizeLanguage(language);
    applyStaticTranslations(doc);
    return currentLanguage;
  }

  const api = { DEFAULT_LANGUAGE, applyStaticTranslations, getDataDragonLocale, getLanguage, getMissingTranslationKeys, normalizeLanguage, setLanguage, translate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UiI18n = api;
})(typeof window !== 'undefined' ? window : globalThis);
