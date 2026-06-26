const test = require('node:test');
const assert = require('node:assert/strict');

const { createMatchDataView } = require('../ui/match-data-view');

function createClassList() {
  return {
    removed: [],
    remove(name) {
      this.removed.push(name);
    }
  };
}

function createElements() {
  return {
    collectRiotMatchesButton: { disabled: true, textContent: '' },
    matchDataMenuButton: {
      disabled: true,
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      }
    },
    collectSeasonRiotMatchesButton: { disabled: true },
    matchDataSeasonHint: { disabled: true, hidden: false },
    matchDataCount: { textContent: '' },
    matchDataRange: { classList: createClassList(), textContent: '' },
    matchDataProgress: { dataset: {}, hidden: false, textContent: '' },
    matchDataMenu: { hidden: false }
  };
}

test('match data view renders empty and populated summaries', () => {
  const elements = createElements();
  const view = createMatchDataView({
    elements,
    formatMatchDataDate: (value) => value
  });

  view.renderMatchDataSummary({ normalizedMatches: 0 });
  assert.equal(elements.matchDataCount.textContent, 'No data');
  assert.equal(elements.matchDataRange.textContent, '試合データが取得されていません');
  assert.equal(elements.matchDataSeasonHint.hidden, true);

  view.renderMatchDataSummary({
    normalizedMatches: 12,
    oldestGameCreation: 'old',
    newestGameCreation: 'new'
  });
  assert.equal(elements.matchDataCount.textContent, '12 matches');
  assert.equal(elements.matchDataRange.textContent, 'old - new');
  assert.equal(elements.matchDataSeasonHint.hidden, false);
});

test('match data view updates status controls and menu state', () => {
  const elements = createElements();
  const timers = [];
  const view = createMatchDataView({
    elements,
    formatMatchDataDate: (value) => value,
    setTimeout: (callback, delayMs) => {
      timers.push({ callback, delayMs });
      return timers.length;
    },
    clearTimeout: () => {}
  });

  view.renderMatchHistoryStatus({ phase: 'collecting', mode: 'season', message: 'loading' });
  assert.equal(elements.collectRiotMatchesButton.disabled, true);
  assert.equal(elements.collectRiotMatchesButton.textContent, 'Downloading season...');
  assert.equal(elements.matchDataProgress.textContent, 'loading');

  view.renderMatchHistoryStatus({ phase: 'completed', updatedMatches: 5, updatedAt: 1 });
  assert.equal(elements.collectRiotMatchesButton.disabled, false);
  assert.equal(elements.collectRiotMatchesButton.textContent, 'Downloaded 5 matches');
  assert.equal(timers[0].delayMs, 3000);

  view.setMatchDataMenuOpen(true);
  assert.equal(view.isMatchDataMenuOpen(), true);
  assert.equal(elements.matchDataMenu.hidden, false);
  assert.equal(elements.matchDataMenuButton.attributes['aria-expanded'], 'true');
});
