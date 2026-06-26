(function attachUiMatchDataView(root) {
  function createMatchDataView(deps) {
    const elements = deps.elements;
    const formatMatchDataDate = deps.formatMatchDataDate;
    const setTimer = deps.setTimeout || root.setTimeout?.bind(root) || setTimeout;
    const clearTimer = deps.clearTimeout || root.clearTimeout?.bind(root) || clearTimeout;
    let matchHistoryButtonTimer = null;
    let dismissedMatchHistoryButtonKey = null;
    let matchDataMenuOpen = false;

    function renderMatchDataSummary(summary) {
      const matchCount = Number(summary?.normalizedMatches || 0);

      elements.matchDataRange.classList.remove('is-error');

      if (matchCount <= 0) {
        elements.matchDataCount.textContent = 'No data';
        elements.matchDataRange.textContent = '試合データが取得されていません';
        elements.matchDataSeasonHint.hidden = true;
        return;
      }

      const oldest = formatMatchDataDate(summary.oldestGameCreation);
      const newest = formatMatchDataDate(summary.newestGameCreation);
      elements.matchDataCount.textContent = `${matchCount} matches`;
      elements.matchDataRange.textContent = oldest && newest
        ? `${oldest} - ${newest}`
        : '期間不明';
      elements.matchDataSeasonHint.hidden = matchCount > 90;
    }

    function renderMatchHistoryStatus(status) {
      const statusKey = `${status?.phase || 'idle'}:${status?.updatedAt || ''}`;

      if (matchHistoryButtonTimer) {
        clearTimer(matchHistoryButtonTimer);
        matchHistoryButtonTimer = null;
      }

      if (!status || status.phase === 'idle') {
        resetMatchHistoryControls();
        renderMatchDataProgress(null);
        dismissedMatchHistoryButtonKey = null;
        return;
      }

      const activePhases = ['collecting', 'normalizing', 'aggregating', 'retrying'];
      const isActive = activePhases.includes(status.phase);

      if (isActive) {
        dismissedMatchHistoryButtonKey = null;
      } else if (dismissedMatchHistoryButtonKey === statusKey) {
        resetMatchHistoryControls();
        renderMatchDataProgress(null);
        return;
      }

      elements.collectRiotMatchesButton.disabled = isActive;
      elements.matchDataMenuButton.disabled = isActive;
      elements.collectSeasonRiotMatchesButton.disabled = isActive;
      elements.matchDataSeasonHint.disabled = isActive;
      elements.collectRiotMatchesButton.textContent = getMatchHistoryButtonText(status);
      renderMatchDataProgress(status);

      if (!isActive) {
        const delayMs = status.phase === 'completed' ? 3000 : 5000;
        matchHistoryButtonTimer = setTimer(() => {
          elements.collectRiotMatchesButton.textContent = 'Download recent match';
          renderMatchDataProgress(null);
          dismissedMatchHistoryButtonKey = statusKey;
        }, delayMs);
      }
    }

    function resetMatchHistoryControls() {
      elements.collectRiotMatchesButton.disabled = false;
      elements.matchDataMenuButton.disabled = false;
      elements.collectSeasonRiotMatchesButton.disabled = false;
      elements.matchDataSeasonHint.disabled = false;
      elements.collectRiotMatchesButton.textContent = 'Download recent match';
    }

    function renderMatchDataProgress(status) {
      const message = status?.message || '';
      elements.matchDataProgress.hidden = !message;
      elements.matchDataProgress.textContent = message;
      elements.matchDataProgress.dataset.phase = status?.phase || '';
    }

    function getMatchHistoryButtonText(status) {
      if (!status) return 'Download recent match';

      if (status.phase === 'collecting') return status.mode === 'season' ? 'Downloading season...' : 'Downloading...';
      if (status.phase === 'normalizing' || status.phase === 'aggregating') return 'Saving...';
      if (status.phase === 'retrying') return 'Retrying...';
      if (status.phase === 'completed') return `Downloaded ${Number(status.updatedMatches || 0)} matches`;
      if (status.phase === 'partial') return `Downloaded ${Number(status.updatedMatches || 0)} matches`;
      if (status.phase === 'error') return 'Download failed';

      return 'Download recent match';
    }

    function setMatchDataMenuOpen(open) {
      matchDataMenuOpen = Boolean(open);
      elements.matchDataMenu.hidden = !matchDataMenuOpen;
      elements.matchDataMenuButton.setAttribute('aria-expanded', String(matchDataMenuOpen));
    }

    function toggleMatchDataMenu() {
      setMatchDataMenuOpen(!matchDataMenuOpen);
    }

    function isMatchDataMenuOpen() {
      return matchDataMenuOpen;
    }

    return {
      getMatchHistoryButtonText,
      isMatchDataMenuOpen,
      renderMatchDataProgress,
      renderMatchDataSummary,
      renderMatchHistoryStatus,
      setMatchDataMenuOpen,
      toggleMatchDataMenu
    };
  }

  const api = { createMatchDataView };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiMatchDataView = api;
})(typeof window !== 'undefined' ? window : globalThis);
