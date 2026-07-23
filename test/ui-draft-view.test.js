const test = require('node:test');
const assert = require('node:assert/strict');
const { setLanguage } = require('../ui/i18n');

setLanguage('ja', { documentElement: {}, querySelectorAll: () => [] });

const { createDraftView } = require('../ui/draft-view');

function createElement(tagName) {
  return {
    tagName,
    children: [],
    className: '',
    textContent: '',
    hidden: false,
    style: {
      setProperty() {}
    },
    append(...children) {
      children.forEach((child) => {
        if (child && typeof child === 'object') {
          child.parentNode = this;
        }
      });
      this.children.push(...children);
    },
    replaceChildren(...children) {
      children.forEach((child) => {
        if (child && typeof child === 'object') {
          child.parentNode = this;
        }
      });
      this.children = children;
    },
    insertBefore(child, beforeChild) {
      const targetIndex = this.children.indexOf(beforeChild);
      if (targetIndex >= 0) {
        this.children.splice(targetIndex, 0, child);
      } else {
        this.children.push(child);
      }
      child.parentNode = this;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener() {},
    querySelector(selector) {
      if (!selector.startsWith('.')) return null;
      const className = selector.slice(1);
      return this.children.find((child) => typeof child?.className === 'string' && child.className.split(' ').includes(className)) || null;
    },
    closest(selector) {
      if (!selector.startsWith('.')) return null;
      const className = selector.slice(1);
      return this.className.split(' ').includes(className) ? this : this.parentNode?.closest?.(selector) || null;
    },
    classList: {
      toggle() {},
      add() {}
    }
  };
}

function createDraftViewForPanel({ status = 'ready', notes = [], requestStatsApiJson = null } = {}) {
  const panel = createElement('section');
  panel.className = 'ban-insight-panel';
  const focus = createElement('div');
  focus.className = 'champion-focus';
  const eyebrow = createElement('p');
  eyebrow.className = 'eyebrow';
  const currentAction = createElement('h3');
  const currentPick = createElement('p');
  focus.append(eyebrow, currentAction, currentPick, panel);
  panel.parentNode = focus;
  eyebrow.parentNode = focus;
  currentAction.parentNode = focus;
  currentPick.parentNode = focus;
  const doc = {
    createElement,
    createTextNode(text) {
      return { textContent: text };
    }
  };

  const view = createDraftView({
    elements: {
      draftAiAnalysisPanel: panel,
      banInsightPanel: panel,
      currentAction,
      currentPick,
      champSelectView: createElement('section'),
      allyBans: createElement('div'),
      enemyBans: createElement('div'),
      allyTeam: createElement('div'),
      enemyTeam: createElement('div'),
      draftSelfSummary: createElement('div')
    },
    document: doc,
    collectBans: () => ({ allyBans: [], enemyBans: [] }),
    getActiveAction: () => null,
    isChampSelectFinalization: () => false,
    championLabel: (id) => `Champion ${id}`,
    championTitle: (id) => `Champion ${id}`,
    positionLabel: (position) => position || '-',
    getPendingLabel: () => 'Pending',
    getMemberChampionId: () => 0,
    requestStatsApiJson,
    loadChampionIcon() {},
    formatPercent: (value) => `${Math.round(Number(value || 0) * 100)}%`,
    createInlineChampionName: () => createElement('span'),
    createChampionStatsElement: () => createElement('div'),
    getChampionRoleDisplayStats: () => null,
    getMarkedLaneOpponentCellId: () => null,
    setMarkedLaneOpponentCellId() {},
    toggleMarkedLaneOpponent() {},
    requestDraftAiAnalysisIfNeeded() {},
    requestFinalCompositionAnalysisIfNeeded() {},
    renderDraftInsights() {},
    getDraftAiAnalysisStatus: () => status,
    getDraftAiAnalysisPhase: () => 'pick',
    getDraftAiAnalysisError: () => '',
    getDraftAiAnalysisNotes: () => notes
  });

  return { panel, focus, currentAction, currentPick, view };
}

test('draft view renders ready AI analysis notes', () => {
  const { panel, view } = createDraftViewForPanel({
    notes: [{ title: 'Pick safely', body: 'Hold cooldowns.' }]
  });

  view.renderDraftAiAnalysis('ready');

  assert.equal(panel.children.length, 2);
  assert.equal(panel.children[1].className, 'draft-ai-analysis-notes');
  assert.equal(panel.children[1].children[0].children[0].textContent, 'Pick safely');
  assert.equal(panel.children[1].children[0].children[1].textContent, 'Hold cooldowns.');
});

test('draft view renders waiting status when analysis is idle', () => {
  const { panel, view } = createDraftViewForPanel({ status: 'idle' });

  view.renderDraftAiAnalysis('idle');

  assert.equal(panel.children[1].className, 'draft-ai-analysis-status');
  assert.equal(panel.children[1].textContent, 'AI分析を待機中・・');
});

test('draft view renders locked-pick recommendations with keystone selector', async () => {
  const requestStatsApiJson = async () => ({
    data: {
      keystones: [
        {
          keystoneId: 8112,
          pickRate: 0.33,
          winRate: 0.52,
          games: 120,
          runes: [{
            primaryStyleId: 8100,
            primaryRuneIds: [8126, 8139],
            secondaryStyleId: 8200,
            secondaryRuneIds: [8234, 8236],
            winRate: 0.53,
            games: 80
          }],
          statShards: [{ shardIds: [5008, 5008, 5011] }],
          summonerSpells: [{ spellIds: [4, 14], winRate: 0.51, games: 72 }]
        },
        {
          keystoneId: 8230,
          pickRate: 0.21,
          winRate: 0.5,
          games: 90,
          runes: [],
          summonerSpells: []
        }
      ]
    }
  });
  const { focus, currentAction, currentPick, view } = createDraftViewForPanel({ requestStatsApiJson });

  view.renderChampSelect({
    localPlayerCellId: 1,
    myTeam: [{ cellId: 1, championId: 103, assignedPosition: 'MIDDLE' }],
    theirTeam: [],
    timer: { phase: 'FINALIZATION' }
  }, 'ChampSelect');

  await new Promise((resolve) => setTimeout(resolve, 0));

  const recommendationPanel = focus.children.find((child) => child.className === 'draft-recommend-panel');
  assert.ok(recommendationPanel);
  assert.equal(currentAction.hidden, true);
  assert.equal(currentPick.hidden, true);
  assert.equal(recommendationPanel.children[0].className, 'draft-recommend-shell');
  assert.equal(recommendationPanel.children[0].children[0].className, 'stats-api-details-top');
  assert.equal(recommendationPanel.children[0].children[0].children[0].className, 'stats-api-keystone-panel');
  assert.equal(recommendationPanel.children[0].children[0].children[0].children[0].className, 'stats-api-keystone-list');
  assert.equal(recommendationPanel.children[0].children[0].children[0].children[0].children.length, 2);
  assert.equal(recommendationPanel.children[0].children[1].className, 'stats-api-detail-grid draft-recommend-grid');
});
