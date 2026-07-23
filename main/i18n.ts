import type { AppLanguage } from '../types/domain/settings';

type Values = Record<string, string | number>;

const messages: Record<AppLanguage, Record<string, string>> = {
  en: {
    'matchHistory.collecting': 'Collecting match data… 0/{requestedMatches} matches',
    'matchHistory.fetchingDetails': 'Downloading match details… {completed}/{total} matches',
    'matchHistory.fetchingTimeline': 'Downloading timelines… {completed}/{total} matches',
    'matchHistory.normalizing': 'Normalizing match data',
    'matchHistory.noneMissing': 'All matches have been downloaded.',
    'matchHistory.rateLimited': 'Waiting for Riot API rate limit… (retrying in {seconds}s)',
    'matchHistory.estimateMinutes': 'about {minutes} min',
    'matchHistory.estimateUnderMinute': 'under 1 min',
    'matchHistory.inProgress': 'Match data is already being downloaded.',
    'matchHistory.loginRequired': 'Log in to the League Client to download match data.',
    'matchHistory.regionUnavailable': 'Could not detect the logged-in server from the League Client.',
    'matchHistory.puuidUnavailable': 'Could not retrieve PUUID from the Riot API.',
    'matchHistory.complete': 'Match data collection complete. Updated {matches} matches.',
    'matchHistory.partial': 'Partially collected match data. Updated {matches} matches / {failed} failed.',
    'matchHistory.fetchingIds': 'Loading match ID list… {matches} matches',
    'matchHistory.serviceUnavailable': 'Check the connection to the match data service.',
    'app.selectInstallDirectory': 'Select League of Legends installation directory',
    'app.installDirectoryRequired': 'League of Legends installation directory is required.',
    'app.clientVersionUnavailable': 'Could not determine the client version.',
    'app.startupErrorTitle': 'Startup error',
    'app.startupErrorMessage': 'An error occurred while starting the app. See debug.log for details.',
    'app.splash.checkingVersion': 'Checking version information…',
    'app.splash.loadingSettings': 'Loading settings…',
    'app.splash.loadingChampionPool': 'Loading champion pool…',
    'app.splash.preparing': 'Preparing the app…',
    'app.splash.showingWindow': 'Opening window…',
    'app.splash.starting': 'Starting the app…',
    'app.riotIdLoginRequired': 'Log in to the League Client to retrieve your Riot ID.',
    'app.riotIdUnavailable': 'Could not retrieve Riot ID and tagline from the LCU current summoner.',
    'season.title': 'Download all season match data',
    'season.eyebrow': 'MATCH DATA',
    'season.description': "Download this season's match data to increase the sample size for ban/pick analysis.",
    'season.estimatedTime': 'Estimated time',
    'season.totalMatches': 'Total matches',
    'season.notDownloaded': 'Not downloaded',
    'season.note': 'This may take time depending on the number of matches. You can continue using the app while it downloads.',
    'season.cancel': 'Cancel',
    'season.startDownload': 'Start download',
    'season.matches': 'matches',
    'update.install': 'Install update',
    'update.quitWithoutInstalling': 'Quit without updating',
    'update.availableTitle': 'Update available',
    'update.availableMessage': 'Install the update now?',
    'update.availableDetail': 'Version {version} is available.',
    'update.failedTitle': 'Update failed',
    'update.failedMessage': 'The update could not be downloaded.',
    'update.tryAgainLater': 'Please try again later.',
    'update.quit': 'Quit',
    'update.status.skipped': 'Skipping update check…',
    'update.status.checking': 'Checking for updates…',
    'update.status.none': 'No update available. Continuing startup…',
    'update.status.checkFailed': 'Update check failed. Continuing startup…',
    'update.status.available': 'Update available. Waiting for your choice…',
    'update.status.quit': 'Quitting without updating…',
    'update.status.downloading': 'Downloading update…',
    'update.status.installing': 'Installing update…',
    'update.status.failed': 'Update failed…'
    , 'lcu.clientNotRunning': 'League Client is not running or you are not logged in: {path}'
    , 'lcu.connectionUnavailable': 'LCU connection information is unavailable.'
    , 'laneAnalysis.rateLimited': 'Lane matchup analysis is busy. Please try again shortly.'
    , 'laneAnalysis.insufficientContext': 'Champion or lane information required for lane matchup analysis is missing.'
    , 'laneAnalysis.unavailable': 'Could not load lane matchup analysis.'
  },
  ja: {
    'matchHistory.collecting': '試合データ収集中... 0/{requestedMatches} 試合',
    'matchHistory.fetchingDetails': '試合詳細を取得中... {completed}/{total} 試合',
    'matchHistory.fetchingTimeline': 'タイムラインを取得中... {completed}/{total} 試合',
    'matchHistory.normalizing': '試合データを正規化しています',
    'matchHistory.noneMissing': '未取得な試合は0件です',
    'matchHistory.rateLimited': 'RiotAPIのRateLimitを待機中... (次回取得まで{seconds}秒)',
    'matchHistory.estimateMinutes': '{minutes}分程度',
    'matchHistory.estimateUnderMinute': '1分未満',
    'matchHistory.inProgress': '試合データを取得中です',
    'matchHistory.loginRequired': '試合データを取得するにはLoLクライアントへログインしてください',
    'matchHistory.regionUnavailable': 'LoLクライアントからログイン先サーバを検出できていません',
    'matchHistory.puuidUnavailable': 'Riot APIからPUUIDを取得できませんでした',
    'matchHistory.complete': '試合データ収集完了 {matches}試合を更新しました',
    'matchHistory.partial': '一部の試合データを収集しました {matches}試合を更新 / {failed}件失敗',
    'matchHistory.fetchingIds': '試合IDリスト取得中... {matches} 試合',
    'matchHistory.serviceUnavailable': '試合データ取得サービスへの接続を確認してください。',
    'app.selectInstallDirectory': 'League of Legends のインストールディレクトリを選択',
    'app.installDirectoryRequired': 'LoLインストールディレクトリが空です',
    'app.clientVersionUnavailable': 'クライアントバージョンを取得できませんでした',
    'app.startupErrorTitle': '起動エラー',
    'app.startupErrorMessage': 'アプリの起動中にエラーが発生しました。debug.log を確認してください。',
    'app.splash.checkingVersion': 'バージョン情報を確認しています...',
    'app.splash.loadingSettings': '設定を読み込んでいます...',
    'app.splash.loadingChampionPool': 'チャンピオンプールを読み込んでいます...',
    'app.splash.preparing': '起動準備をしています...',
    'app.splash.showingWindow': 'ウィンドウを表示しています...',
    'app.splash.starting': '起動を開始しています...',
    'app.riotIdLoginRequired': 'Riot IDを取得するにはLoLクライアントへログインしてください',
    'app.riotIdUnavailable': 'LCU current summonerからRiot IDとTaglineを取得できませんでした',
    'season.title': 'シーズン中の全試合データ取得',
    'season.eyebrow': '試合データ',
    'season.description': '今シーズンの試合データをまとめて取得し、BAN / PICK 分析のサンプル数を増やします。',
    'season.estimatedTime': '予想時間',
    'season.totalMatches': '対象試合',
    'season.notDownloaded': '未取得',
    'season.note': '試合数によっては時間がかかります。取得中もアプリはそのまま利用できます。',
    'season.cancel': 'キャンセル',
    'season.startDownload': '取得を開始',
    'season.matches': '試合',
    'update.install': 'アップデートする',
    'update.quitWithoutInstalling': 'アップデートせずに終了する',
    'update.availableTitle': 'アップデートがあります',
    'update.availableMessage': 'アップデートしますか？',
    'update.availableDetail': '新しいバージョン {version} が利用できます。',
    'update.failedTitle': 'アップデートに失敗しました',
    'update.failedMessage': 'アップデートのダウンロードに失敗しました。',
    'update.tryAgainLater': '時間をおいて再度お試しください。',
    'update.quit': '終了する',
    'update.status.skipped': 'アップデート確認をスキップしています...',
    'update.status.checking': 'アップデートを確認しています...',
    'update.status.none': 'アップデートはありません。起動を続けます...',
    'update.status.checkFailed': 'アップデート確認に失敗したため通常起動します...',
    'update.status.available': 'アップデートが見つかりました。選択を待っています...',
    'update.status.quit': 'アップデートせずに終了します...',
    'update.status.downloading': 'アップデートをダウンロードしています...',
    'update.status.installing': 'アップデートを適用しています...',
    'update.status.failed': 'アップデートに失敗しました...'
    , 'lcu.clientNotRunning': 'LoLクライアントが起動していないか、ログインしていません: {path}'
    , 'lcu.connectionUnavailable': 'LCU接続情報がありません'
    , 'laneAnalysis.rateLimited': 'AI対面分析のリクエストが混み合っています。少し待ってから再度お試しください。'
    , 'laneAnalysis.insufficientContext': 'AI対面分析に必要なチャンピオンまたはレーン情報が不足しています。'
    , 'laneAnalysis.unavailable': 'AI対面分析を取得できませんでした。'
  }
};

function translate(language: AppLanguage | string | undefined, key: string, values: Values = {}): string {
  const template = messages[language === 'ja' ? 'ja' : 'en'][key] || messages.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? `{${name}}`));
}

export = { translate };
