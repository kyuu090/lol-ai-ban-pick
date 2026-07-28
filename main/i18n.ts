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
  },
  kr: {}
};

Object.assign(messages.kr, messages.en, {
  'matchHistory.collecting': '경기 데이터를 수집하는 중... 0/{requestedMatches}게임',
  'matchHistory.fetchingDetails': '경기 상세를 가져오는 중... {completed}/{total}게임',
  'matchHistory.fetchingTimeline': '타임라인을 가져오는 중... {completed}/{total}게임',
  'matchHistory.normalizing': '경기 데이터를 정규화하는 중',
  'matchHistory.noneMissing': '다운로드하지 않은 경기가 없습니다.',
  'matchHistory.rateLimited': 'Riot API 요청 제한을 기다리는 중… ({seconds}초 후 재시도)',
  'matchHistory.estimateMinutes': '약 {minutes}분', 'matchHistory.estimateUnderMinute': '1분 미만',
  'matchHistory.inProgress': '경기 데이터를 이미 다운로드하고 있습니다.',
  'matchHistory.loginRequired': '경기 데이터를 다운로드하려면 League Client에 로그인하세요.',
  'matchHistory.regionUnavailable': 'League Client에서 로그인 서버를 감지할 수 없습니다.',
  'matchHistory.puuidUnavailable': 'Riot API에서 PUUID를 가져올 수 없습니다.',
  'matchHistory.complete': '경기 데이터 수집 완료. {matches}게임을 업데이트했습니다.',
  'matchHistory.partial': '경기 데이터를 일부 수집했습니다. {matches}게임 업데이트 / {failed}건 실패.',
  'matchHistory.fetchingIds': '경기 ID 목록을 불러오는 중… {matches}게임',
  'matchHistory.serviceUnavailable': '경기 데이터 서비스 연결을 확인하세요.',
  'app.selectInstallDirectory': 'League of Legends 설치 디렉터리 선택', 'app.installDirectoryRequired': 'League of Legends 설치 디렉터리가 필요합니다.', 'app.clientVersionUnavailable': '클라이언트 버전을 확인할 수 없습니다.',
  'app.startupErrorTitle': '시작 오류', 'app.startupErrorMessage': '앱을 시작하는 중 오류가 발생했습니다. 자세한 내용은 debug.log를 확인하세요.',
  'app.splash.checkingVersion': '버전 정보를 확인하는 중…', 'app.splash.loadingSettings': '설정을 불러오는 중…', 'app.splash.loadingChampionPool': '챔피언 풀을 불러오는 중…', 'app.splash.preparing': '앱을 준비하는 중…', 'app.splash.showingWindow': '창을 여는 중…', 'app.splash.starting': '시작하는 중…',
  'app.riotIdLoginRequired': 'Riot ID를 가져오려면 League Client에 로그인하세요.', 'app.riotIdUnavailable': 'LCU current summoner에서 Riot ID와 태그라인을 가져올 수 없습니다.',
  'season.title': '시즌 전체 경기 데이터 다운로드', 'season.eyebrow': '경기 데이터', 'season.description': '이번 시즌 경기 데이터를 다운로드하여 밴/픽 분석의 표본 수를 늘립니다.', 'season.estimatedTime': '예상 시간', 'season.totalMatches': '전체 경기', 'season.notDownloaded': '다운로드하지 않음', 'season.note': '경기 수에 따라 시간이 걸릴 수 있습니다. 다운로드 중에도 앱을 계속 사용할 수 있습니다.', 'season.cancel': '취소', 'season.startDownload': '다운로드 시작', 'season.matches': '게임',
  'update.install': '업데이트 설치', 'update.quitWithoutInstalling': '업데이트 없이 종료', 'update.availableTitle': '업데이트 가능', 'update.availableMessage': '지금 업데이트를 설치할까요?', 'update.availableDetail': '버전 {version}을 사용할 수 있습니다.', 'update.failedTitle': '업데이트 실패', 'update.failedMessage': '업데이트를 다운로드할 수 없습니다.', 'update.tryAgainLater': '잠시 후 다시 시도하세요.', 'update.quit': '종료', 'update.status.skipped': '업데이트 확인을 건너뛰는 중…', 'update.status.checking': '업데이트를 확인하는 중…', 'update.status.none': '업데이트가 없습니다. 시작을 계속합니다…', 'update.status.checkFailed': '업데이트 확인에 실패했습니다. 시작을 계속합니다…', 'update.status.available': '업데이트를 찾았습니다. 선택을 기다리는 중…', 'update.status.quit': '업데이트 없이 종료하는 중…', 'update.status.downloading': '업데이트를 다운로드하는 중…', 'update.status.installing': '업데이트를 설치하는 중…', 'update.status.failed': '업데이트 실패…',
  'lcu.clientNotRunning': 'League Client가 실행 중이 아니거나 로그인하지 않았습니다: {path}', 'lcu.connectionUnavailable': 'LCU 연결 정보를 사용할 수 없습니다.',
  'laneAnalysis.rateLimited': '라인 상성 분석 요청이 많습니다. 잠시 후 다시 시도하세요.', 'laneAnalysis.insufficientContext': '라인 상성 분석에 필요한 챔피언 또는 라인 정보가 없습니다.', 'laneAnalysis.unavailable': '라인 상성 분석을 불러올 수 없습니다.'
});

function translate(language: AppLanguage | string | undefined, key: string, values: Values = {}): string {
  const selectedLanguage: AppLanguage = language === 'ja' || language === 'kr' ? language : 'en';
  const template = messages[selectedLanguage][key] || messages.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? `{${name}}`));
}

export = { translate };
