// SorareHub - Zero-DNP Cascade Lineup Optimizer (All Competitions + National Team Break Safe)
const OptimizerEngine = {
  buildCascadePortfolio(allCards, competition, scarcity, strategy, selectedGw = null) {
    if (!Array.isArray(allCards) || allCards.length === 0 || !competition) return [];

    const targetScarcity = String(scarcity || 'limited').toLowerCase();
    const isSO7 = competition.format === 'SO7';
    const slotsTemplate = isSO7
      ? ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'EXTRA']
      : ['GK', 'DEF', 'MID', 'FWD', 'EXTRA'];
    const requiredInSeason = Number(competition.inSeasonRequired || 0);

    // 1. Filtra per rarità, età (U23) e lega di appartenenza della carta
    const eligibleCards = allCards.filter(card => {
      if (!card) return false;
      if (card.scarcity !== targetScarcity) return false;
      if (competition.u23Only && !card.isU23) return false;

      if (Array.isArray(competition.leagues) && !competition.leagues.includes('ALL')) {
        const cardLeague = String(card.leagueSlug || '').toLowerCase();
        const matchesLeague = competition.leagues.some(l => cardLeague.includes(String(l).toLowerCase()));
        if (!matchesLeague) return false;
      }

      return true;
    });

    if (eligibleCards.length < slotsTemplate.length) return [];

    // 2. Valuta ogni carta sulla Gameweek selezionata con regola Zero-DNP
    const evaluatedPool = eligibleCards.map(card => this.evaluateCardForGw(card, selectedGw, strategy));

    const lineups = [];
    const usedPlayerSlugs = new Set();
    const maxLineups = 5;

    for (let rank = 1; rank <= maxLineups; rank++) {
      const available = evaluatedPool.filter(c => !usedPlayerSlugs.has(c.playerSlug));
      if (available.length < slotsTemplate.length) break;

      const picked = this.selectBestLineupForSlots(available, slotsTemplate, requiredInSeason);
      if (!picked || picked.length < slotsTemplate.length) break;

      // Impedisci la generazione di formazioni interamente prive di partite nella GW
      const activePlayersInLineup = picked.filter(p => Boolean(p.activeMatch)).length;
      if (activePlayersInLineup === 0) break;

      picked.forEach(p => usedPlayerSlugs.add(p.playerSlug));

      // Assegna il Capitano (+50%) esclusivamente a chi ha una partita reale nella GW
      const candidatesForCaptain = picked.filter(p => Boolean(p.activeMatch));
      const captainPool = candidatesForCaptain.length > 0 ? candidatesForCaptain : picked;
      captainPool.sort((a, b) => b.projectedScore - a.projectedScore);
      const captainId = captainPool[0]?.id;

      const finalStarters = picked.map(p => {
        const isCap = p.id === captainId && Boolean(p.activeMatch);
        const finalScore = isCap ? Number((p.projectedScore * 1.5).toFixed(1)) : p.projectedScore;
        return {
          ...p,
          isCaptain: isCap,
          projectedScore: finalScore
        };
      });

      const totalProjected = Number(
        finalStarters.reduce((acc, p) => acc + p.projectedScore, 0).toFixed(1)
      );
      const inSeasonCount = finalStarters.filter(p => p.isInSeason).length;

      lineups.push({
        rank: rank,
        rankLabel: `Squadra #${rank}`,
        format: isSO7 ? 'SO7' : 'SO5',
        inSeasonCount: inSeasonCount,
        activeMatchesCount: activePlayersInLineup,
        totalProjected: totalProjected,
        starters: finalStarters
      });
    }

    return lineups;
  },

  evaluateCardForGw(card, selectedGw, strategy) {
    const games = Array.isArray(card.scheduleGames) ? card.scheduleGames : [];
    let activeMatch = null;

    if (selectedGw && selectedGw.startDate && selectedGw.endDate) {
      const gwStart = new Date(selectedGw.startDate).getTime();
      const gwEnd = new Date(selectedGw.endDate).getTime();
      activeMatch = games.find(g => g.timestamp >= gwStart && g.timestamp <= gwEnd) || null;
    } else if (games.length > 0) {
      const nowMs = Date.now() - 6 * 3600 * 1000;
      activeMatch = games.find(g => g.timestamp >= nowMs) || games[0];
    }

    // Regola Zero-DNP: se non ha partita in questa GW, punteggio proiettato = 0
    if (!activeMatch) {
      return {
        ...card,
        activeMatch: null,
        isHome: null,
        opponentName: 'Nessuna partita',
        availabilityTier: 'dnp',
        isLastResort: true,
        unavailableReason: card.baseUnavailableReason || 'Nessuna partita nella GW selezionata',
        projectedScore: 0,
        selectionPriority: 0,
        matchupInsight: `${card.name} non ha partite programmate in questa Gameweek (0 pt attesi).`
      };
    }

    // Se ha una partita reale nella GW ma è segnalato infortunato/squalificato
    if (card.baseUnavailableReason && (card.baseUnavailableReason.includes('Infortunato') || card.baseUnavailableReason.includes('Squalificato'))) {
      return {
        ...card,
        activeMatch: activeMatch,
        isHome: activeMatch.isHome,
        opponentName: activeMatch.opponentName,
        availabilityTier: 'dnp',
        isLastResort: true,
        unavailableReason: card.baseUnavailableReason,
        projectedScore: 0,
        selectionPriority: 0,
        matchupInsight: `${card.name}: ${card.baseUnavailableReason}.`
      };
    }

    const baseL15 = card.l15 > 0 ? card.l15 : (card.l5 > 0 ? card.l5 : 35);
    const baseL5 = card.l5 > 0 ? card.l5 : baseL15;
    const isCeiling = String(strategy || '').toLowerCase() === 'ceiling';

    let rawExpected = isCeiling
      ? (baseL5 * 0.55) + (baseL15 * 0.25) + ((card.maxRecentScore || baseL5) * 0.20)
      : (baseL15 * 0.55) + (baseL5 * 0.35) + ((card.avgAas || 15) * 0.25);

    if (activeMatch.isHome === true) rawExpected *= 1.04;
    if (card.baseFitnessTier === 'rotation') rawExpected *= 0.85;

    const projectedScore = Number(Math.max(15, rawExpected * (card.powerMultiplier || 1)).toFixed(1));
    const priorityTier = card.baseFitnessTier === 'starter' ? 2 : 1;

    const matchLabel = activeMatch.isNationalTeam
      ? `${activeMatch.teamName} (${activeMatch.competitionName})`
      : `${activeMatch.isHome ? 'In casa' : 'In trasferta'} contro ${activeMatch.opponentName}`;

    const insight = `${matchLabel}. Media L15: ${card.l15}, L5: ${card.l5}, minuti medi: ${card.avgMins}'. Strategia ${isCeiling ? 'Ceiling (picchi decisivi)' : 'Floor (regolarità AA)'}.`;

    return {
      ...card,
      activeMatch: activeMatch,
      isHome: activeMatch.isHome,
      opponentName: activeMatch.opponentName,
      availabilityTier: card.baseFitnessTier === 'starter' ? 'starter' : 'rotation',
      isLastResort: false,
      unavailableReason: '',
      projectedScore: projectedScore,
      selectionPriority: priorityTier,
      matchupInsight: insight
    };
  },

  selectBestLineupForSlots(pool, slotsTemplate, requiredInSeason) {
    const selected = [];
    const usedIds = new Set();

    // Ordina sempre dando precedenza assoluta a:
    // 1) Chi ha una partita reale nella GW (selectionPriority > 0)
    // 2) Chi è titolare fisso (selectionPriority === 2) rispetto a rotazione (1) e DNP (0)
    // 3) Punteggio proiettato più alto
    const sortCandidates = (list, preferInSeason) => {
      return [...list].sort((a, b) => {
        const aHasGame = a.selectionPriority > 0 ? 1 : 0;
        const bHasGame = b.selectionPriority > 0 ? 1 : 0;
        if (bHasGame !== aHasGame) return bHasGame - aHasGame;

        if (preferInSeason && a.isInSeason !== b.isInSeason) {
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
        }

        if (b.selectionPriority !== a.selectionPriority) {
          return b.selectionPriority - a.selectionPriority;
        }

        return b.projectedScore - a.projectedScore;
      });
    };

    for (let i = 0; i < slotsTemplate.length; i++) {
      const slotRole = slotsTemplate[i];
      const currentInSeason = selected.filter(s => s.isInSeason).length;
      const remainingSlots = slotsTemplate.length - i;
      const needInSeasonNow = (requiredInSeason - currentInSeason) >= remainingSlots;

      const roleCandidates = pool.filter(c => {
        if (usedIds.has(c.id)) return false;
        if (slotRole === 'EXTRA') return c.position !== 'GK';
        return c.position === slotRole;
      });

      if (roleCandidates.length === 0) return null;

      const sorted = sortCandidates(roleCandidates, needInSeasonNow || requiredInSeason > 0);
      const chosen = sorted[0];
      if (!chosen) return null;

      usedIds.add(chosen.id);
      selected.push({
        ...chosen,
        slotRole: slotRole
      });
    }

    const finalInSeasonCount = selected.filter(s => s.isInSeason).length;
    if (finalInSeasonCount < requiredInSeason) return null;

    return selected;
  }
};

window.OptimizerEngine = OptimizerEngine;
