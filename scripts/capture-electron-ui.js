// @ts-check

const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  CAPTURE_SETTINGS,
  createCaptureState,
  createDraftCaptureState,
  createChampionIconDataUrl,
  createStatsFixtureResponse
} = require('./ui-capture-fixtures');

const projectRoot = path.resolve(__dirname, '..');

/**
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((entry) => entry.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

/** @param {string} name */
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

/** @param {string} value */
function normalizeTarget(value) {
  return ['champions', 'build', 'matchups', 'matchup', 'timeline', 'draft-ban', 'draft-pick', 'draft-pick-pool'].includes(value) ? value : 'timeline';
}

/** @param {string} value */
function normalizeLane(value) {
  const lane = String(value || '').toUpperCase();
  return ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].includes(lane) ? lane : 'MIDDLE';
}

/**
 * @param {string} value
 * @param {number} fallback
 */
function positiveInteger(value, fallback) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : fallback;
}

const target = normalizeTarget(readOption('view', 'timeline'));
const captureLane = normalizeLane(readOption('lane', 'MIDDLE'));
const themeMode = readOption('theme', 'light') === 'dark' ? 'dark' : 'light';
const statsSource = readOption('stats-source', 'production') === 'fixture' ? 'fixture' : 'production';
const width = positiveInteger(readOption('width', '1440'), 1440);
const height = positiveInteger(readOption('height', '900'), 900);
const scrollMode = readOption('scroll', 'top') === 'bottom' ? 'bottom' : 'top';
const hoverSelector = readOption('hover', '').trim();
const showWindow = hasFlag('show');
const holdMs = Math.max(0, Number(readOption('hold-ms', showWindow ? '5000' : '0')) || 0);
const defaultOutput = path.join(projectRoot, '.tmp-ui-captures', `${target}-${themeMode}.png`);
const outputPath = path.resolve(readOption('output', defaultOutput));
const captureState = target === 'draft-ban'
  ? createDraftCaptureState('ban')
  : target === 'draft-pick' || target === 'draft-pick-pool'
    ? createDraftCaptureState('pick')
    : createCaptureState(themeMode);
captureState.settings.themeMode = themeMode;
const captureSettings = { ...CAPTURE_SETTINGS, themeMode };

app.disableHardwareAcceleration();

/**
 * @param {string} channel
 * @param {(...args: any[]) => any} handler
 */
function handle(channel, handler) {
  ipcMain.handle(channel, handler);
}

function registerFixtureIpc() {
  handle('lcu:get-state', () => captureState);
  handle('lcu:refresh', () => captureState);
  handle('lcu:get-champion-icon', (_event, championId) => createChampionIconDataUrl(Number(championId)));
  handle('champion-pool:get', () => captureState.championPool);
  handle('champion-pool:save', (_event, championPool) => championPool);
  handle('settings:get', () => captureSettings);
  handle('app:get-client-version', () => '16.13.1');
  handle('settings:choose-lol-install-dir', () => captureSettings);
  handle('settings:update-lol-install-dir', () => captureSettings);
  handle('settings:update-riot-platform-region', () => captureSettings);
  handle('settings:update-theme-mode', () => captureSettings);
  handle('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  handle('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return window.isMaximized();
  });
  handle('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  handle('lcu:resolve-in-game-stats-opponent', () => null);
  handle('riot-match-history:collect', () => captureState.matchHistorySummary);
  handle('stats-api:request', async (_event, pathOrUrl) => {
    if (statsSource === 'fixture') {
      if (target.startsWith('draft-') && /\/matchups(?:\?|$)/.test(String(pathOrUrl))) {
        await delay(600);
      }
      return createStatsFixtureResponse(pathOrUrl);
    }
    const { requestStatsDbApiJson } = require(path.join(projectRoot, 'dist-app', 'stats-db-api.js'));
    return requestStatsDbApiJson(pathOrUrl);
  });
  handle('openai:pick-phase', () => ({
    notes: [
      { title: '対面候補を比較', body: 'StatsAPIの対面勝率と自分のChampionPoolを合わせて選択できます。' },
      { title: '使用不可を自動除外', body: 'BAN済み・他プレイヤーがPICK済みの候補は対面候補から除外しています。' }
    ]
  }));
  handle('openai:final-composition', () => ({ notes: [] }));
  ipcMain.on('log:renderer', () => undefined);
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {Electron.BrowserWindow} window
 * @param {string} expression
 * @param {string} label
 * @param {number} [timeoutMs]
 */
async function waitForRenderer(window, expression, label, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await window.webContents.executeJavaScript(`Boolean(${expression})`, true).catch(() => false);
    if (ready) return;
    await delay(60);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

/**
 * @param {Electron.BrowserWindow} window
 * @param {string} expression
 * @param {string} label
 */
async function clickByScript(window, expression, label) {
  const result = await window.webContents.executeJavaScript(`(() => { try { const element = ${expression}; if (!element) return { clicked: false, error: 'element not found' }; element.click(); return { clicked: true }; } catch (error) { return { clicked: false, error: String(error?.stack || error) }; } })()`, true);
  if (!result?.clicked) throw new Error(`Could not click ${label}: ${result?.error || 'unknown renderer error'}.`);
}

/** @param {Electron.BrowserWindow} window */
async function openCaptureTarget(window) {
  if (target === 'draft-ban' || target === 'draft-pick' || target === 'draft-pick-pool') {
    await waitForRenderer(window, "!document.querySelector('#draftView')?.hidden", 'draft view');
    if (target === 'draft-pick') {
      await clickByScript(
        window,
        "Array.from(document.querySelectorAll('.lane-opponent-target')).find((element) => element.textContent.includes('ゼド'))",
        'mock lane opponent'
      );
      await waitForRenderer(window, "document.querySelectorAll('.pool-card-grid .draft-champion-card').length >= 10 && document.querySelector('.marked-opponent-insight .ban-insight-empty')?.textContent.includes('取得中')", 'immediate champion pool');
    } else if (target === 'draft-ban') {
      await waitForRenderer(window, "document.querySelectorAll('.lane-history-section li').length > 0 && document.querySelector('.planned-pick-threat-section .ban-insight-empty')?.textContent.includes('取得中')", 'immediate lane history');
    } else {
      await waitForRenderer(window, "document.querySelectorAll('.pool-card-grid .draft-champion-card').length >= 10", 'champion pool cards');
      return;
    }
    await waitForRenderer(window, "document.querySelectorAll('.counter-card-grid .draft-champion-card').length >= 5", 'draft matchup cards');
    return;
  }
  await waitForRenderer(window, "document.querySelectorAll('#statsApiChampionsTableBody tr').length > 0", 'champion rows');
  await clickByScript(window, "document.querySelector('[data-view=\"champions\"]')", 'Champions tab');
  if (target === 'champions') return;

  await clickByScript(
    window,
    `document.querySelector('#statsApiLaneTabs button[data-lane=${JSON.stringify(captureLane)}]')`,
    `${captureLane} lane tab`
  );
  await waitForCaptureIdle(window);
  await waitForRenderer(window, "document.querySelectorAll('#statsApiChampionsTableBody tr').length > 0", `${captureLane} champion rows`);

  await clickByScript(
    window,
    "document.querySelector('#statsApiChampionsTableBody tr[data-champion-id=\"103\"]') || document.querySelector('#statsApiChampionsTableBody tr')",
    'champion row'
  );
  await waitForRenderer(window, "document.querySelectorAll('.stats-api-analysis-tab').length === 3", 'analysis tabs');
  if (target === 'build') return;

  const tabLabel = target === 'timeline' ? 'タイムライン分析' : 'マッチアップ分析';
  await clickByScript(
    window,
    `Array.from(document.querySelectorAll('.stats-api-analysis-tab')).find((button) => button.textContent.includes(${JSON.stringify(tabLabel)}))`,
    `${tabLabel} tab`
  );
  if (target === 'timeline') {
    await waitForRenderer(window, "document.querySelectorAll('.stats-api-timeline-chart-card').length >= 4", 'timeline dashboard');
    return;
  }

  await waitForRenderer(window, "document.querySelectorAll('.stats-api-matchups-table tbody tr').length > 0", 'matchup rows');
  if (target === 'matchups') return;
  await clickByScript(window, "document.querySelector('.stats-api-matchups-table tbody tr')", 'first matchup row');
  await waitForRenderer(window, "document.querySelectorAll('.stats-api-timeline-chart-card').length >= 4", 'matchup timeline dashboard');
}

/** @param {Electron.BrowserWindow} window */
async function waitForCaptureIdle(window) {
  await waitForRenderer(
    window,
    "document.querySelector('.stats-api-champions-panel')?.getAttribute('aria-busy') === 'false' && document.querySelector('.stats-api-loading-overlay')?.hidden === true",
    'StatsAPI loading overlay to close',
    30000
  );
}

async function capture() {
  registerFixtureIpc();
  await app.whenReady();
  /** @type {string[]} */
  const consoleErrors = [];
  const window = new BrowserWindow({
    width,
    height,
    show: true,
    ...(showWindow ? {} : { x: -10000, y: -10000, skipTaskbar: true }),
    frame: false,
    backgroundColor: themeMode === 'dark' ? '#11152b' : '#f5f4ff',
    webPreferences: {
      preload: path.join(projectRoot, 'dist-app', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  window.setMenu(null);
  window.webContents.on('console-message', (event) => {
    const details = /** @type {Electron.WebContentsConsoleMessageEventParams} */ (event);
    if (String(details.message).includes('Electron Security Warning')) return;
    if (details.level === 'warning' || details.level === 'error') {
      consoleErrors.push(String(details.message));
    }
  });
  await window.loadFile(path.join(projectRoot, 'dist-app', 'index.html'));
  await openCaptureTarget(window);
  await waitForCaptureIdle(window);
  await window.webContents.insertCSS(`
    *, *::before, *::after { animation: none !important; transition: none !important; }
    html, body { scroll-behavior: auto !important; }
    .stats-api-loading-overlay { display: none !important; }
  `);
  await window.webContents.executeJavaScript(`window.scrollTo(0, 0); document.querySelectorAll(".stats-api-details-view, .stats-table-wrap").forEach((element) => { element.scrollTop = ${scrollMode === 'bottom' ? 'element.scrollHeight' : '0'}; element.scrollLeft = 0; }); document.body.getBoundingClientRect();`, true);
  let hoverResult = null;
  if (hoverSelector) {
    hoverResult = await window.webContents.executeJavaScript(`(() => {
      const element = document.querySelector(${JSON.stringify(hoverSelector)});
      if (!element) return { hovered: false, error: 'element not found' };
      const rect = element.getBoundingClientRect();
      const eventOptions = {
        bubbles: false,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        pointerType: 'mouse'
      };
      element.dispatchEvent(new PointerEvent('pointerenter', eventOptions));
      element.dispatchEvent(new PointerEvent('pointermove', eventOptions));
      const tooltip = element.closest('.stats-api-timeline-chart-wrap, .stats-api-impact-chart-wrap')
        ?.querySelector('.stats-api-timeline-tooltip');
      return {
        hovered: true,
        tooltipHidden: tooltip?.hidden,
        tooltipText: tooltip?.textContent || ''
      };
    })()`, true);
    if (!hoverResult?.hovered || hoverResult.tooltipHidden !== false) {
      throw new Error(`Could not show hover tooltip for ${hoverSelector}: ${hoverResult?.error || 'tooltip stayed hidden'}.`);
    }
  }
  window.webContents.invalidate();
  await delay(300);
  const image = await window.webContents.capturePage();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, image.toPNG());
  process.stdout.write(`${JSON.stringify({ outputPath, target, captureLane, themeMode, statsSource, width, height, scrollMode, hoverSelector, hoverResult, consoleErrors }, null, 2)}\n`);
  if (holdMs > 0) await delay(holdMs);
  if (!window.isDestroyed()) window.destroy();
  app.quit();
}

capture().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  app.exit(1);
});
