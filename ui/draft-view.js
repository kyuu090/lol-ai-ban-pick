(function attachUiDraftView(root) {
  function createDraftView(deps) {
    const elements = deps.elements;
    const doc = deps.document || root.document;

    function renderChampSelect(champSelect, gameflowPhase) {
      const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
      const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
      const { allyBans, enemyBans } = deps.collectBans(champSelect, allyTeam, enemyTeam);
      const localCellId = champSelect?.localPlayerCellId;
      const activeAction = deps.getActiveAction(champSelect, localCellId);
      const localMember = allyTeam.find((member) => member.cellId === localCellId);
      const isLocalTurn = activeAction?.actorCellId === localCellId;
      const isDraftActionPhase = String(champSelect?.timer?.phase || '').toUpperCase() === 'BAN_PICK';
      const isLocalPickTurn = isDraftActionPhase && Boolean(activeAction?.isInProgress) && isLocalTurn && activeAction?.type === 'pick';
      if (deps.getMarkedLaneOpponentCellId() !== null && !enemyTeam.some((member) => member.cellId === deps.getMarkedLaneOpponentCellId())) {
        deps.setMarkedLaneOpponentCellId(null);
      }

      elements.champSelectView.classList.toggle('local-turn', isLocalTurn);
      renderBanList(elements.allyBans, allyBans);
      renderBanList(elements.enemyBans, enemyBans);
      renderTeam(elements.allyTeam, allyTeam, 'ally', { activeAction, localCellId });
      renderTeam(elements.enemyTeam, enemyTeam, 'enemy', {
        activeAction,
        localCellId,
        localAssignedPosition: localMember?.assignedPosition,
        markedLaneOpponentCellId: deps.getMarkedLaneOpponentCellId()
      });
      renderDraftFocus(champSelect, activeAction);
      if (isLocalPickTurn) {
        deps.requestDraftAiAnalysisIfNeeded(champSelect, localMember, activeAction);
      }
      if (deps.isChampSelectFinalization(champSelect, gameflowPhase)) {
        deps.requestFinalCompositionAnalysisIfNeeded(champSelect, localMember);
      }
      renderDraftAiAnalysis(deps.getDraftAiAnalysisStatus());
    }

    function renderDraftAiAnalysis(status) {
      if (!elements.draftAiAnalysisPanel) return;

      const panel = elements.draftAiAnalysisPanel;
      panel.replaceChildren();

      const header = doc.createElement('div');
      header.className = 'draft-ai-analysis-header';

      const titleBlock = doc.createElement('div');
      const eyebrow = doc.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = 'AI Analysis';
      const title = doc.createElement('h3');
      title.textContent = deps.getDraftAiAnalysisPhase() === 'final_composition' ? '最終構成分析' : 'バンピック分析';
      titleBlock.append(eyebrow, title);

      const badge = doc.createElement('span');
      badge.className = `draft-ai-analysis-badge ${status}`;
      badge.textContent = status === 'ready' ? 'DONE' : status === 'requesting' ? 'ASKING' : status === 'error' ? 'ERROR' : 'WAITING';
      header.append(titleBlock, badge);
      panel.append(header);

      if (status === 'requesting') {
        panel.append(createDraftAiAnalysisStatus(deps.getDraftAiAnalysisPhase() === 'final_composition'
          ? 'AIに最終構成を分析依頼中・・'
          : 'AIに分析を依頼中・・'));
        return;
      }

      if (status === 'error') {
        panel.append(createDraftAiAnalysisStatus(deps.getDraftAiAnalysisError() || 'AI分析を取得できませんでした。'));
        return;
      }

      if (status !== 'ready') {
        panel.append(createDraftAiAnalysisStatus('AI分析を待機中・・'));
        return;
      }

      const notes = deps.getDraftAiAnalysisNotes();
      if (!notes.length) {
        panel.append(createDraftAiAnalysisStatus('AI分析を表示できませんでした。'));
        return;
      }

      const list = doc.createElement('div');
      list.className = 'draft-ai-analysis-notes';
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

    function createDraftAiAnalysisStatus(text) {
      const message = doc.createElement('p');
      message.className = 'draft-ai-analysis-status';
      message.textContent = text;
      return message;
    }

    function renderBanList(container, bans) {
      container.replaceChildren(...bans.slice(0, 5).map((championId) => {
        const item = doc.createElement('span');
        item.className = 'ban-token';
        item.title = deps.championTitle(championId);

        const icon = doc.createElement('img');
        icon.alt = '';
        icon.className = 'ban-token-icon';
        deps.loadChampionIcon(icon, championId);

        const label = doc.createElement('span');
        label.textContent = deps.championLabel(championId);

        item.append(icon, label);
        return item;
      }));

      if (bans.length === 0) {
        const item = doc.createElement('span');
        item.className = 'ban-token empty';
        item.textContent = 'BANなし';
        container.append(item);
      }
    }

    function renderTeam(container, team, side, turnState = {}) {
      const rows = Array.from({ length: 5 }, (_, index) => team[index] ?? { cellId: index, championId: 0 });

      container.replaceChildren(...rows.map((member) => {
        const row = doc.createElement('article');
        const isRealMember = team.includes(member);
        const selected = Number(member.championId) > 0;
        const intendedChampionId = Number(member.championPickIntent);
        const hasIntent = !selected && intendedChampionId > 0;
        const portraitChampionId = selected ? Number(member.championId) : intendedChampionId;
        const isLocalMember = member.cellId === turnState.localCellId;
        const isActiveMember = member.cellId === turnState.activeAction?.actorCellId;
        const isLocalActiveMember = isLocalMember && isActiveMember;
        const isEnemyMember = side === 'enemy' && isRealMember;
        const isMarkedLaneOpponent = isEnemyMember && member.cellId === turnState.markedLaneOpponentCellId;
        row.className = `pick-row ${side} ${selected ? 'selected' : hasIntent ? 'intent' : 'empty'}${isLocalMember ? ' local-player' : ''}${isActiveMember ? ' active-turn' : ''}${isLocalActiveMember ? ' local-active-turn' : ''}${isEnemyMember ? ' lane-opponent-target' : ''}${isMarkedLaneOpponent ? ' marked-lane-opponent' : ''}`;
        if (isEnemyMember) {
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.setAttribute('aria-pressed', String(isMarkedLaneOpponent));
          row.title = isMarkedLaneOpponent ? 'Click to unmark lane opponent' : 'Click to mark as lane opponent';
          row.addEventListener('click', () => deps.toggleMarkedLaneOpponent(member.cellId));
          row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              deps.toggleMarkedLaneOpponent(member.cellId);
            }
          });
        }

        const portrait = doc.createElement('div');
        portrait.className = `champion-portrait ${hasIntent ? 'intent' : ''}`;
        portrait.title = portraitChampionId > 0 ? deps.championTitle(portraitChampionId) : '';

        if (portraitChampionId > 0) {
          const image = doc.createElement('img');
          image.alt = deps.championLabel(portraitChampionId);
          deps.loadChampionIcon(image, portraitChampionId);
          portrait.append(image);
        } else {
          portrait.textContent = '?';
        }

        const portraitStack = doc.createElement('div');
        portraitStack.className = 'pick-portrait-stack';

        const roleBadge = doc.createElement('span');
        roleBadge.className = 'pick-role-badge';
        roleBadge.textContent = deps.positionLabel(member.assignedPosition);

        portraitStack.append(portrait, roleBadge);

        const meta = doc.createElement('div');
        meta.className = 'pick-meta';

        const champion = doc.createElement('strong');
        champion.textContent = selected ? deps.championLabel(member.championId) : deps.getPendingLabel(member, deps.championLabel);

        meta.append(champion);
        if (isMarkedLaneOpponent) {
          const marker = doc.createElement('span');
          marker.className = 'lane-opponent-marker';
          marker.textContent = turnState.localAssignedPosition
            ? `${deps.positionLabel(turnState.localAssignedPosition)} OPPONENT`
            : 'LANE OPPONENT';
          meta.append(marker);
        }
        row.append(portraitStack, meta);
        return row;
      }));
    }

    function renderDraftFocus(champSelect, activeAction = deps.getActiveAction(champSelect)) {
      const localCellId = champSelect?.localPlayerCellId;
      const localMember = champSelect?.myTeam?.find((member) => member.cellId === localCellId);
      const isDraftActionPhase = String(champSelect?.timer?.phase || '').toUpperCase() === 'BAN_PICK';
      renderDraftSelfSummary(localMember);
      renderDraftInsights(null, { champSelect, localMember });

      if (activeAction) {
        const isActionInProgress = Boolean(activeAction.isInProgress);
        const isLocalTurn = isDraftActionPhase && isActionInProgress && activeAction.actorCellId === localCellId;
        const insightType = isDraftActionPhase && isActionInProgress ? activeAction.type : null;
        const actionLabel = activeAction.type === 'ban' ? 'BAN' : 'PICK';
        elements.currentAction.textContent = isLocalTurn ? `YOUR ${actionLabel}` : isDraftActionPhase && isActionInProgress ? `${actionLabel} PHASE` : 'Waiting';
        renderDraftInsights(insightType, { champSelect, localMember });
        elements.currentPick.textContent = isLocalTurn
          ? activeAction.type === 'ban' ? 'あなたのBANです' : 'あなたのPICKです'
          : isDraftActionPhase && isActionInProgress ? `Summoner ${(activeAction.actorCellId ?? 0) + 1} の操作待ちです` : 'チャンピオン選択情報を監視しています。';
        return;
      }

      elements.currentAction.textContent = localMember?.championId ? deps.championLabel(localMember.championId) : '待機中';
      elements.currentPick.textContent = 'チャンピオン選択情報を監視しています。';
    }

    function renderDraftSelfSummary(localMember) {
      if (!elements.draftSelfSummary) return;

      const championId = deps.getMemberChampionId(localMember);
      elements.draftSelfSummary.replaceChildren();
      elements.draftSelfSummary.hidden = !championId;
      if (!championId) return;

      const header = doc.createElement('div');
      header.className = 'draft-self-summary-header';

      const label = doc.createElement('span');
      label.className = 'draft-self-summary-label';
      label.textContent = 'Your';

      const champion = deps.createInlineChampionName(championId, 'inline-champion-name draft-self-summary-name');
      header.append(label, champion);

      const stats = deps.createChampionStatsElement(
        deps.getChampionRoleDisplayStats(championId, localMember?.assignedPosition),
        'draft-self-summary-stats',
        { includeGames: false }
      );

      elements.draftSelfSummary.append(header, stats);
    }

    function renderDraftInsights(type, context = {}) {
      if (type === 'ban') {
        renderBanInsights(true, context.champSelect, context.localMember);
      } else if (type === 'pick') {
        renderPickPoolInsights(true, context.champSelect, context.localMember);
      } else if (context.champSelect && context.localMember && getMarkedLaneOpponentChampionId(context.champSelect)) {
        renderMarkedOpponentPickInsights(true, context.champSelect, context.localMember);
      } else {
        renderInsightPanel(false);
      }
    }

    function renderInsightPanel(visible, mode = '') {
      const focus = elements.banInsightPanel?.closest('.champion-focus');
      if (!elements.banInsightPanel || !focus) return null;

      elements.banInsightPanel.hidden = !visible;
      elements.banInsightPanel.className = `ban-insight-panel${mode ? ` ${mode}` : ''}`;
      focus.classList.toggle('has-ban-insights', visible);
      focus.classList.toggle('insight-only', visible);
      if (!visible) {
        elements.banInsightPanel.replaceChildren();
        return null;
      }

      return elements.banInsightPanel;
    }

    function renderBanInsights(visible, champSelect, localMember) {
      const panel = renderInsightPanel(visible, 'ban-mode');
      if (!panel) return;

      const position = String(localMember?.assignedPosition || '').toUpperCase();
      const minGames = getBanInsightMinGames();
      const plannedPickThreatSection = createPlannedPickBanThreatSection(champSelect, localMember, position, minGames);
      const laneStats = deps.sortWorstWinRateStats(deps.getMatchHistoryLaneOpponentStats().filter((stats) => (
        String(stats.position || '').toUpperCase() === position &&
        Number(stats.games || 0) >= minGames
      ))).slice(0, deps.BAN_INSIGHT_LIMIT);
      const enemyStats = deps.sortWorstWinRateStats(deps.getMatchHistoryEnemyChampionStats().filter((stats) => (
        Number(stats.games || 0) >= minGames
      ))).slice(0, deps.BAN_INSIGHT_LIMIT);

      const sections = [
        createBanInsightSampleControl(champSelect, localMember),
        createBanInsightSection(`${deps.positionLabel(position)} lane opponents`, laneStats)
      ];
      if (plannedPickThreatSection) {
        sections.splice(1, 0, plannedPickThreatSection);
      }
      sections.push(createCollapsedBanInsightSection('Worst enemy picks', enemyStats));

      panel.replaceChildren(...sections);
    }

    function getBanInsightMinGames() {
      return deps.BAN_INSIGHT_SAMPLE_OPTIONS.includes(deps.getBanInsightMinGames()) ? deps.getBanInsightMinGames() : 5;
    }

    function createBanInsightSampleControl(champSelect, localMember) {
      const control = doc.createElement('div');
      control.className = 'ban-insight-control';

      const label = doc.createElement('label');
      label.className = 'ban-insight-sample-filter';

      const text = doc.createElement('span');
      text.textContent = 'Sample';

      const select = doc.createElement('select');
      select.setAttribute('aria-label', 'Ban insight sample filter');
      deps.BAN_INSIGHT_SAMPLE_OPTIONS.forEach((games) => {
        const option = doc.createElement('option');
        option.value = String(games);
        option.textContent = `${games}+ games`;
        select.append(option);
      });
      select.value = String(getBanInsightMinGames());
      select.addEventListener('change', () => {
        deps.setBanInsightMinGames(Number(select.value));
        deps.logDebug('Ban insight sample filter changed', { minGames: deps.getBanInsightMinGames() });
        renderBanInsights(true, champSelect, localMember);
      });

      label.append(text, select);
      control.append(label);
      return control;
    }

    function createPlannedPickBanThreatSection(champSelect, localMember, position, minGames) {
      const { plannedChampionId, statsList } = deps.getPlannedPickThreatStats({
        stats: deps.getMatchHistorySelfVsLaneOpponentStats().filter((stats) => (
          Number(stats.games || 0) >= minGames &&
          Number(stats.winRate || 0) < 0.5
        )),
        champSelect,
        localMember,
        limit: deps.BAN_INSIGHT_LIMIT
      });
      if (!plannedChampionId || !position) return null;

      const section = doc.createElement('section');
      section.className = 'ban-insight-section planned-pick-threat-section';

      const heading = doc.createElement('h4');
      heading.append(
        'Threats for your ',
        deps.createInlineChampionName(plannedChampionId, 'inline-champion-name heading-champion-name'),
        ` ${deps.positionLabel(position)}`
      );
      section.append(heading);

      if (!statsList.length) {
        const empty = doc.createElement('p');
        empty.className = 'ban-insight-empty';
        empty.textContent = 'No losing same-role matchup history';
        section.append(empty);
        return section;
      }

      const list = doc.createElement('ol');
      statsList.forEach((stats) => {
        list.append(createPlannedPickBanThreatItem(stats));
      });
      section.append(list);
      return section;
    }

    function createPlannedPickBanThreatItem(stats) {
      const item = doc.createElement('li');

      const nameBlock = doc.createElement('span');
      nameBlock.className = 'ban-insight-name';
      nameBlock.append(deps.createInlineChampionName(stats.opponentChampionId));

      const detail = deps.createWinRateStatsElement(stats, { includeKda: true });

      item.append(nameBlock, detail);
      deps.appendLowSampleBadge(nameBlock, stats.games);

      return item;
    }

    function renderPickPoolInsights(visible, champSelect, localMember) {
      const panel = renderInsightPanel(visible, 'pick-mode');
      if (!panel) return;

      const normalizedChampionPool = deps.normalizeChampionPool(deps.getChampionPool());
      deps.setChampionPool(normalizedChampionPool);
      const lane = deps.getChampionPoolLaneByPosition(localMember?.assignedPosition);
      const position = String(localMember?.assignedPosition || '').toUpperCase();
      const championIds = lane ? normalizedChampionPool[lane.id] || [] : [];
      const unavailableReasons = deps.collectUnavailableChampionReasons(champSelect);
      const candidates = championIds.map((championId) => {
        const stats = deps.getChampionRoleDisplayStats(championId, position);
        const unavailableReason = unavailableReasons.get(Number(championId)) || '';

        return {
          championId,
          stats,
          unavailableReason,
          available: !unavailableReason
        };
      });
      const sortedCandidates = deps.sortPickPoolCandidates(candidates, deps.RELIABLE_SAMPLE_GAMES);
      const visibleCandidates = sortedCandidates.slice(0, deps.PICK_POOL_CANDIDATE_LIMIT);

      const header = doc.createElement('section');
      header.className = 'pick-pool-header';

      const title = doc.createElement('h4');
      title.textContent = lane ? `Your ${lane.label} Pool` : 'Your Pool';

      const summary = doc.createElement('p');
      summary.textContent = championIds.length > 0
        ? `${visibleCandidates.length}/${championIds.length} candidates`
        : 'No champions registered for this role';

      header.append(title, summary);

      if (!visibleCandidates.length) {
        const empty = doc.createElement('p');
        empty.className = 'ban-insight-empty';
        empty.textContent = lane ? 'ChampionPool is empty' : 'Assigned role is unknown';
        panel.replaceChildren(
          ...createMarkedOpponentInsightElements(champSelect, localMember),
          header,
          empty
        );
        return;
      }

      const list = doc.createElement('ol');
      list.className = 'pick-pool-list';
      visibleCandidates.forEach((candidate) => {
        list.append(createPickPoolCandidateItem(candidate, position));
      });

      panel.replaceChildren(
        ...createMarkedOpponentInsightElements(champSelect, localMember),
        header,
        list
      );
    }

    function renderMarkedOpponentPickInsights(visible, champSelect, localMember) {
      const panel = renderInsightPanel(visible, 'pick-mode marked-opponent-mode');
      if (!panel) return;

      const insightElements = createMarkedOpponentInsightElements(champSelect, localMember);
      if (!insightElements.length) {
        renderInsightPanel(false);
        return;
      }

      panel.replaceChildren(...insightElements);
    }

    function createMarkedOpponentInsightElements(champSelect, localMember) {
      const opponentChampionId = getMarkedLaneOpponentChampionId(champSelect);
      const position = String(localMember?.assignedPosition || '').toUpperCase();
      if (!opponentChampionId || !position) return [];

      const statsList = deps.getBestIntoOpponentStats({
        stats: deps.getMatchHistorySelfVsLaneOpponentStats(),
        opponentChampionId,
        position,
        limit: 5
      });

      const section = doc.createElement('section');
      section.className = 'marked-opponent-insight';

      const header = doc.createElement('div');
      header.className = 'pick-pool-header';

      const title = doc.createElement('h4');
      title.append('Best into ', deps.createInlineChampionName(opponentChampionId, 'inline-champion-name heading-champion-name'));

      const summary = doc.createElement('p');
      summary.textContent = `${deps.positionLabel(position)} history`;

      header.append(title, summary);
      section.append(header);

      if (!statsList.length) {
        const empty = doc.createElement('p');
        empty.className = 'ban-insight-empty';
        empty.textContent = 'No direct history';
        section.append(empty);
        return [section];
      }

      const list = doc.createElement('ol');
      list.className = 'pick-pool-list marked-opponent-list';
      statsList.forEach((stats) => {
        list.append(createMarkedOpponentPickItem(stats));
      });
      section.append(list);

      return [section];
    }

    function getMarkedLaneOpponentChampionId(champSelect) {
      if (deps.getMarkedLaneOpponentCellId() === null) return null;

      const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
      const member = enemyTeam.find((enemy) => enemy.cellId === deps.getMarkedLaneOpponentCellId());
      const championId = Number(member?.championId || member?.championPickIntent) || 0;
      return championId > 0 ? championId : null;
    }

    function createMarkedOpponentPickItem(stats) {
      const item = doc.createElement('li');
      item.className = 'pick-pool-candidate marked-opponent-candidate';

      const name = deps.createInlineChampionName(stats.championId);

      const detail = deps.createWinRateStatsElement(stats, { includeGames: false, includeKda: true });
      item.append(name, detail);

      deps.appendLowSampleBadge(item, stats.games);

      return item;
    }

    function createPickPoolCandidateItem(candidate, position) {
      const item = doc.createElement('li');
      item.className = `pick-pool-candidate${candidate.available ? '' : ' unavailable'}`;

      const name = deps.createInlineChampionName(candidate.championId);

      const detail = createPickPoolCandidateStatsElement(candidate.stats, position);

      item.append(name, detail);

      if (candidate.unavailableReason) {
        const status = doc.createElement('em');
        status.textContent = candidate.unavailableReason;
        item.append(status);
      } else {
        deps.appendLowSampleBadge(item, candidate.stats?.games);
      }

      return item;
    }

    function createPickPoolCandidateStatsElement(stats, position) {
      const container = doc.createElement('span');
      container.className = 'pick-pool-stats';

      if (!stats || !stats.games) {
        container.append(deps.createPickPoolStatChip('Games', `No ${deps.positionLabel(position)}`));
        return container;
      }

      const wins = Number(stats.wins || 0);
      const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, Number(stats.games || 0) - wins);
      [
        ['W-L', `${wins}-${losses}`],
        ['WR', deps.formatPercent(stats.winRate)],
        ['KDA', deps.formatAverageKda(stats)]
      ].forEach(([label, value]) => {
        container.append(deps.createPickPoolStatChip(label, value));
      });

      return container;
    }

    function createBanInsightSection(title, statsList) {
      const section = doc.createElement('section');
      section.className = 'ban-insight-section';

      const heading = doc.createElement('h4');
      heading.textContent = title;
      section.append(heading);

      if (!statsList.length) {
        const empty = doc.createElement('p');
        empty.className = 'ban-insight-empty';
        empty.textContent = 'No match data';
        section.append(empty);
        return section;
      }

      const list = doc.createElement('ol');
      statsList.forEach((stats) => {
        list.append(createBanInsightItem(stats));
      });
      section.append(list);
      return section;
    }

    function createCollapsedBanInsightSection(title, statsList) {
      const details = doc.createElement('details');
      details.className = 'ban-insight-details';

      const summary = doc.createElement('summary');
      summary.textContent = title;
      details.append(summary);

      const section = createBanInsightSection(title, statsList);
      section.querySelector('h4')?.remove();
      details.append(section);
      return details;
    }

    function createBanInsightItem(stats) {
      const item = doc.createElement('li');

      const nameBlock = doc.createElement('span');
      nameBlock.className = 'ban-insight-name';
      nameBlock.append(deps.createInlineChampionName(stats.championId));

      const detail = deps.createWinRateStatsElement(stats);

      item.append(nameBlock, detail);
      deps.appendLowSampleBadge(nameBlock, stats.games);

      return item;
    }

    return {
      renderChampSelect,
      renderDraftAiAnalysis
    };
  }

  const api = { createDraftView };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiDraftView = api;
})(typeof window !== 'undefined' ? window : globalThis);
