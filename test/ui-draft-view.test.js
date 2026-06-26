const test = require('node:test');
const assert = require('node:assert/strict');

const { createDraftView } = require('../ui/draft-view');

function createElement(tagName) {
  return {
    tagName,
    children: [],
    className: '',
    textContent: '',
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    classList: {
      toggle() {}
    }
  };
}

function createDraftViewForPanel({ status = 'ready', notes = [] } = {}) {
  const panel = createElement('section');
  const doc = {
    createElement,
    createTextNode(text) {
      return { textContent: text };
    }
  };

  const view = createDraftView({
    elements: { draftAiAnalysisPanel: panel },
    document: doc,
    collectBans: () => ({ allyBans: [], enemyBans: [] }),
    getActiveAction: () => null,
    isChampSelectFinalization: () => false,
    championLabel: (id) => `Champion ${id}`,
    championTitle: (id) => `Champion ${id}`,
    positionLabel: (position) => position || '-',
    getPendingLabel: () => 'Pending',
    getMemberChampionId: () => 0,
    loadChampionIcon() {},
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

  return { panel, view };
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
