(function attachUiInGameView(root) {
  function createInGameView(deps) {
    const elements = deps.elements;
    const doc = deps.document || root.document;

    function renderInGame(state) {
      const context = deps.createInGameContext({
        champSelect: deps.getLastChampSelectSnapshot(),
        summonerName: deps.getSummonerName(state.summoner),
        matchupStats: deps.getMatchHistorySelfVsLaneOpponentStats()
      });

      renderInGameSelfCard(context);
      renderInGameLaneMatchupAnalysis(state.laneMatchupAnalysis);
      renderInGameFinalCompositionAnalysis();
    }

    function renderInGameSelfCard({ championId, position, summonerName }) {
      elements.inGameSelfPortrait.replaceChildren();

      if (championId > 0) {
        const image = doc.createElement('img');
        image.alt = deps.championLabel(championId);
        deps.loadChampionIcon(image, championId);
        elements.inGameSelfPortrait.append(image);
      } else {
        elements.inGameSelfPortrait.textContent = '?';
      }

      elements.inGameChampionName.textContent = championId > 0 ? deps.championLabel(championId) : '試合中です';
      elements.inGameChampionDetail.textContent = championId > 0
        ? `${deps.positionLabel(position)} / ${summonerName || 'Summoner'}`
        : 'ドラフト情報が取得できた試合では、ここに今回のピックメモを表示します。';

      const stats = championId > 0 ? deps.getChampionRoleDisplayStats(championId, position) : null;
      elements.inGameSelfStats.replaceChildren();
      elements.inGameSelfStats.append(createInGameStatsSummary(stats, position));
    }

    function createInGameStatsSummary(stats, position) {
      const container = doc.createElement('div');
      container.className = 'in-game-self-stats';

      if (!stats || !stats.games) {
        container.append(deps.createPickPoolStatChip('Games', `No ${deps.positionLabel(position)}`));
        container.append(deps.createPickPoolStatChip('Focus', 'Fresh run'));
        return container;
      }

      const wins = Number(stats.wins || 0);
      const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, Number(stats.games || 0) - wins);
      [
        ['Games', `${stats.games}`],
        ['W-L', `${wins}-${losses}`],
        ['WR', deps.formatPercent(stats.winRate)],
        ['KDA', deps.formatAverageKda(stats)]
      ].forEach(([label, value]) => {
        container.append(deps.createPickPoolStatChip(label, value));
      });

      return container;
    }

    function renderInGameFinalCompositionAnalysis() {
      const panel = elements.inGameFinalCompositionAnalysis;
      if (!panel) return;

      const status = deps.getFinalCompositionAnalysisStatus();
      const notes = deps.getFinalCompositionAnalysisNotes();
      const error = deps.getFinalCompositionAnalysisError();

      panel.replaceChildren();

      const header = doc.createElement('div');
      header.className = 'in-game-ai-analysis-header';

      const badge = doc.createElement('span');
      badge.className = `draft-ai-analysis-badge ${status}`;
      badge.textContent = status === 'ready'
        ? 'DONE'
        : status === 'requesting'
          ? 'ASKING'
          : status === 'error'
            ? 'ERROR'
            : 'WAITING';
      header.append(createInGameAiHeaderTitle('AI Analysis'), badge);
      panel.append(header);

      if (status === 'requesting') {
        panel.append(createDraftAiAnalysisStatus('AIに最終構成を分析依頼中・・'));
        return;
      }

      if (status === 'error') {
        panel.append(createDraftAiAnalysisStatus(error || 'AI分析を取得できませんでした。'));
        return;
      }

      if (status !== 'ready') {
        panel.append(createDraftAiAnalysisStatus('最終構成分析を待機中・・'));
        return;
      }

      if (!notes.length) {
        panel.append(createDraftAiAnalysisStatus('AI分析を表示できませんでした。'));
        return;
      }

      const list = doc.createElement('div');
      list.className = 'in-game-ai-analysis-notes';
      notes.forEach((note) => {
        const item = doc.createElement('article');
        item.className = 'draft-ai-analysis-note';

        const noteTitle = doc.createElement('strong');
        noteTitle.textContent = note.title;

        const body = doc.createElement('p');
        body.textContent = note.body;

        item.append(noteTitle, body);
        list.append(item);
      });
      panel.append(list);
    }

    function renderInGameLaneMatchupAnalysis(analysis) {
      const panel = elements.inGameLaneMatchupAnalysis;
      if (!panel) return;

      panel.replaceChildren();

      const header = doc.createElement('div');
      header.className = 'in-game-ai-analysis-header';

      const badge = doc.createElement('span');
      const status = analysis?.status || 'idle';
      badge.className = `draft-ai-analysis-badge ${status}`;
      badge.textContent = status === 'ready'
        ? 'DONE'
        : status === 'requesting'
          ? 'ASKING'
          : status === 'error'
            ? 'ERROR'
            : 'WAITING';
      const response = analysis?.response || {};
      const headerMeta = doc.createElement('div');
      headerMeta.className = 'in-game-ai-analysis-header-meta';
      headerMeta.append(badge);

      header.append(createInGameAiHeaderTitle('AI Matchup'), headerMeta);
      panel.append(header);

      if (status === 'requesting') {
        panel.append(createDraftAiAnalysisStatus('AIにレーン対面分析を依頼中...'));
        return;
      }

      if (status === 'error') {
        panel.append(createDraftAiAnalysisStatus(analysis?.error || 'AI対面分析を取得できませんでした。'));
        return;
      }

      if (status !== 'ready') {
        panel.append(createDraftAiAnalysisStatus('GameStart / InProgress の対面情報を待っています。'));
        return;
      }

      const request = analysis?.request?.payload || {};
      const summary = response.laneSummary || {};
      const detail = normalizeLaneMatchupDetail(summary.detail);

      const goalCard = createLaneMatchupGoalCard({
        goal: summary.goal,
        championIds: analysis?.request?.enemyChampionIds,
        championName: String(request.enemyChampionName || '').trim(),
        difficulty: response.difficulty,
        laneStyle: response.laneStyle
      });
      if (goalCard) {
        panel.append(goalCard);
      }

      const detailCard = createLaneMatchupDetailCard(detail);
      if (detailCard) {
        panel.append(detailCard);
      }
    }

    function createLaneMatchupGoalCard({ goal, championIds, championName, difficulty, laneStyle }) {
      if (!hasLaneMatchupRichText(goal)) return null;

      const card = doc.createElement('article');
      card.className = 'draft-ai-analysis-note lane-matchup-goal';

      const header = doc.createElement('div');
      header.className = 'lane-matchup-card-header';

      const title = doc.createElement('strong');
      title.textContent = 'Lane Plan';

      const badges = doc.createElement('div');
      badges.className = 'lane-matchup-card-badges';
      [
        ['Difficulty', difficulty],
        ['Style', laneStyle]
      ].forEach(([label, value]) => {
        const badge = createLaneMatchupBadge(label, value);
        if (badge) badges.append(badge);
      });
      header.append(title);
      if (badges.children.length) {
        header.append(badges);
      }

      const body = doc.createElement('p');
      body.className = 'lane-matchup-goal-text';
      body.append(createLaneMatchupOpponentVisual({ championIds, championName }));
      body.append(doc.createTextNode(' '), createLaneMatchupRichText(goal));

      card.append(header, body);
      return card;
    }

    function createLaneMatchupDetailCard(detail) {
      const items = (Array.isArray(detail) ? detail : [])
        .filter(hasLaneMatchupRichText)
        .slice(0, 3);
      if (!items.length) return null;

      const card = doc.createElement('article');
      card.className = 'draft-ai-analysis-note lane-matchup-detail';

      const title = doc.createElement('strong');
      title.textContent = 'Detail';

      const list = doc.createElement('ul');
      list.className = 'lane-matchup-detail-list';
      items.forEach((richText) => {
        const item = doc.createElement('li');
        item.append(createLaneMatchupRichText(richText));
        list.append(item);
      });

      card.append(title, list);
      return card;
    }

    function normalizeLaneMatchupDetail(detail) {
      return (Array.isArray(detail) ? detail : [])
        .map(normalizeLaneMatchupDetailItem)
        .filter(hasLaneMatchupRichText);
    }

    function normalizeLaneMatchupDetailItem(item) {
      if (Array.isArray(item)) {
        return item.filter(isLaneMatchupRichTextToken);
      }

      if (item && typeof item === 'object') {
        const text = String(item.text || item.body || item.description || item.detail || '').trim();
        return isLaneMatchupStructuralFragment(text) ? '' : text;
      }

      const text = String(item || '').trim();
      return isLaneMatchupStructuralFragment(text) ? '' : text;
    }

    function isLaneMatchupRichTextToken(token) {
      if (!token || typeof token !== 'object') return false;
      if (token.type === 'text') return !isLaneMatchupStructuralFragment(token.text);
      if (token.type === 'champion') return String(token.championName || '').trim().length > 0;
      return false;
    }

    function isLaneMatchupStructuralFragment(value) {
      const text = String(value || '').trim();
      if (!text) return true;
      if (/^[{}\[\],]+$/.test(text)) return true;
      if (/^"?[A-Za-z0-9_-]+"?\s*:\s*[{\[]?$/.test(text)) return true;
      return false;
    }

    function createLaneMatchupBadge(label, value) {
      const text = String(value || '').trim();
      if (!text) return null;

      const badge = doc.createElement('span');
      badge.className = 'lane-matchup-badge';

      const badgeLabel = doc.createElement('small');
      badgeLabel.textContent = label;

      const badgeValue = doc.createElement('b');
      badgeValue.textContent = text;

      badge.append(badgeLabel, badgeValue);
      return badge;
    }

    function hasLaneMatchupRichText(value) {
      if (Array.isArray(value)) {
        return value.some(isLaneMatchupRichTextToken);
      }

      return !isLaneMatchupStructuralFragment(value);
    }

    function createLaneMatchupRichText(value) {
      const fragment = doc.createDocumentFragment();

      if (!Array.isArray(value)) {
        fragment.append(doc.createTextNode(String(value || '').trim()));
        return fragment;
      }

      value.forEach((token) => {
        if (!token || typeof token !== 'object') return;

        if (token.type === 'text') {
          fragment.append(doc.createTextNode(String(token.text || '')));
          return;
        }

        if (token.type === 'champion') {
          const champion = createLaneMatchupInlineChampion(token);
          if (champion) fragment.append(champion);
        }
      });

      return fragment;
    }

    function createLaneMatchupInlineChampion(token) {
      const championName = String(token?.championName || '').trim();
      if (!championName) return null;

      const championId = Number(token.championId);
      const container = doc.createElement('span');
      container.className = 'lane-matchup-inline-champion';
      container.title = championName;

      if (Number.isInteger(championId) && championId > 0) {
        const image = doc.createElement('img');
        image.alt = championName;
        image.title = deps.championTitle(championId);
        image.className = 'lane-matchup-inline-champion-icon';
        deps.loadChampionIconEager(image, championId);
        container.append(image);
      }

      const label = doc.createElement('span');
      label.textContent = championName;
      container.append(label);
      return container;
    }

    function createLaneMatchupOpponentVisual({ championIds, championName }) {
      const container = doc.createElement('span');
      container.className = 'lane-matchup-title-opponent';
      container.title = championName ? `vs ${championName}` : 'vs 相手';

      const label = doc.createElement('span');
      label.textContent = 'vs';
      container.append(label);

      const ids = (Array.isArray(championIds) ? championIds : [])
        .map((championId) => Number(championId))
        .filter((championId) => Number.isInteger(championId) && championId > 0)
        .slice(0, 2);

      if (!ids.length) {
        const fallback = doc.createElement('span');
        fallback.textContent = championName || '相手';
        container.append(fallback);
        return container;
      }

      ids.forEach((championId) => {
        const image = doc.createElement('img');
        image.alt = deps.championLabel(championId);
        image.title = deps.championTitle(championId);
        image.className = 'lane-matchup-title-opponent-icon';
        deps.loadChampionIconEager(image, championId);
        container.append(image);
      });

      return container;
    }

    function createInGameAiHeaderTitle(text) {
      const title = doc.createElement('p');
      title.className = 'eyebrow';
      title.textContent = text;
      return title;
    }

    function createDraftAiAnalysisStatus(text) {
      const message = doc.createElement('p');
      message.className = 'draft-ai-analysis-status';
      message.textContent = text;
      return message;
    }

    return {
      hasLaneMatchupRichText,
      normalizeLaneMatchupDetail,
      renderInGame,
      renderInGameFinalCompositionAnalysis,
      renderInGameLaneMatchupAnalysis
    };
  }

  const api = { createInGameView };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiInGameView = api;
})(typeof window !== 'undefined' ? window : globalThis);
