const test = require('node:test');
const assert = require('node:assert/strict');
const { registerIpcHandlers } = require('../main/ipc-handlers');

test('registerIpcHandlers wires renderer channels to provided handlers', () => {
  const handled = [];
  const listened = [];
  const handlers = {
    getState: () => {},
    refreshLcuState: () => {},
    getChampionIcon: () => {},
    getChampionPool: () => {},
    saveChampionPool: () => {},
    getSettings: () => {},
    chooseLolInstallDir: () => {},
    updateLolInstallDir: () => {},
    updateRiotPlatformRegion: () => {},
    updateThemeMode: () => {},
    minimizeWindow: () => {},
    toggleMaximizeWindow: () => {},
    closeWindow: () => {},
    collectRiotMatchHistory: () => {},
    requestStatsApiJson: () => {},
    requestPickPhaseAnalysis: () => {},
    requestFinalCompositionAnalysis: () => {}
  };
  const logRendererMessage = () => {};

  registerIpcHandlers({
    ipcMain: {
      handle: (channel, handler) => handled.push([channel, handler]),
      on: (channel, listener) => listened.push([channel, listener])
    },
    handlers,
    logRendererMessage
  });

  assert.deepEqual(handled.map(([channel]) => channel), [
    'lcu:get-state',
    'lcu:refresh',
    'lcu:get-champion-icon',
    'champion-pool:get',
    'champion-pool:save',
    'settings:get',
    'settings:choose-lol-install-dir',
    'settings:update-lol-install-dir',
    'settings:update-riot-platform-region',
    'settings:update-theme-mode',
    'window:minimize',
    'window:toggle-maximize',
    'window:close',
    'riot-match-history:collect',
    'stats-api:request',
    'openai:pick-phase',
    'openai:final-composition'
  ]);
  assert.equal(handled[0][1], handlers.getState);
  assert.deepEqual(listened, [['log:renderer', logRendererMessage]]);
});
