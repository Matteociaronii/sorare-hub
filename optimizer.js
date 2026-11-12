// SorareHub - Strict Anti-Duplicate + National Teams Only in All-Star + Contender/League Safe Optimizer
const OptimizerEngine = {
  CHAMPION_LEAGUES: ['premier-league', 'serie-a', 'laliga', 'la-liga', 'primera-division', 'bundesliga', 'ligue-1'],
  CHALLENGER_LEAGUES: ['eredivisie', 'primeira-liga', 'liga-portugal', 'jupiler-pro-league', 'first-division-a', 'super-lig', 'turkish-super-lig', 'premiership', 'scottish-premiership', 'mls', 'major-league-soccer', 'superliga', 'danish-superliga', 'bundesliga-at', 'austrian-bundesliga', 'super-league', 'swiss-super-league'],

  isCardEligibleForCompetition(card, competition) {
    const compId = String(competition.id || '').toLowerCase();
    const compName = String(competition.name || '').toLowerCase();
    const cardLeague = String(card.leagueSlug || '').toLowerCase();

    if (competition.u23Only || compId.includes('u23')) {
      return Boolean(card.isU23);
    }

    if (compId.includes('all_star') || compId.includes('all-star') || compName.includes('all-star')) {
      return true;
    }

    // Contender: tutte le leghe non Champion (2ª serie, Asia, Sudamerica, Croazia, Polonia, Belgio/Austria/Scozia/ecc.)
    if (compId.includes('contender') || compName.includes('contender')) {
      const isBig5 = this.CHAMPION_LEAGUES.some(l => cardLeague.includes(l));
      return !isBig5 && cardLeague !== 'other';
    }

    // Challenger
    if (compId.includes('challenger') || compName.includes('challenger')) {
      const isBig5 = this.CHAMPION_LEAGUES.some(l => cardLeague.includes(l));
      if (isBig5) return false;
      if (this.CHALLENGER_LEAGUES.some(l => cardLeague.includes(l))) return true;
      if (Array.isArray(competition.leagues)) {
        return competition.leagues.some(l => cardLeague.includes(String(l).toLowerCase()));
      }
      return true;
    }

    // Champion Europe
    if (compId.includes('champion') || compName.includes('champion')) {
      return this.CHAMPION_LEAGUES.some(l => cardLeague.includes(l));
    }

    if (Array.isArray(competition.leagues) && !competition.leagues.includes('ALL')) {
      return competition.leagues.some(l => cardLeague.includes(String(l).toLowerCase()));
    }

    return true;
  },

  buildCascadePortfolio(allCards, competition, scarcity, strategy, selectedGw = null) {
    if (!Array.isArray(allCards) || allCards.length === 0 || !competition) return [];

    const targetScarcity = String(scarcity || 'limited').toLowerCase();
    const isSO7 = competition.format === 'SO7';
    const slotsTemplate = isSO7
      ? ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'EXTRA']
      : ['GK', 'DEF', 'MID', 'FWD', 'EXTRA'];
    const requiredInSeason = Number(competition.inSeasonRequired || 0);

    const compId = String(competition.id || '').toLowerCase();
    const compName = String(competition.name || '').toLowerCase();
    // Regola richiesta: le partite delle Nazionali valgono SOLO in All-Star!
    const allowNationalTeamMatches = compId.includes('all_star') || compId.includes('all-star') || compName.includes('all-star');

    // 1. Filtra per rarità e lega e rimuove doppioni della stessa carta tenendo sempre la versione più forte (In-Season > Classic, poi bonus più alto)
    const eligibleCards = allCards.filter(card => {
      if (!card) return false;
      if (card.scarcity !== targetScarcity) return false;
      return this.isCardEligibleForCompetition(card, competition);
    });

    if (eligibleCards.length < slotsTemplate.length) return [];

    // 2. Valuta ogni carta sulla Gameweek selezionata (filtrando le Nazionali fuori dai campionati di club)
    const evaluatedPool = eligibleCards.map(card =>
      this.evaluateCardForGw(card, selectedGw, strategy, allowNationalTeamMatches)
    );

    const lineups = [];
    const usedPlayerSlugsGlobal = new Set();
    const maxLineups = 5;

    for (let rank = 1; rank <= maxLineups; rank++) {
      const available = evaluatedPool.filter(c => !usedPlayerSlugsGlobal.has(c.playerSlug));
      if (available.length < slotsTemplate.length) break;

      let picked = this.selectBestLineupForSlots(available, slotsTemplate, requiredInSeason);

      // Se in Contender / Campionato non ci sono abbastanza In-Season per arrivare a 4/5, mostra comunque la formazione con il massimo di In-Season possibili
      if (!picked && requiredInSeason > 0) {
        picked = this.selectBestLineupForSlots(available, slotsTemplate, 0);
      }

      if (!picked || picked.length < slotsTemplate.length) break;

      const activePlayersInLineup = picked.filter(p => Boolean(p.activeMatch)).length;

      // In All-Star (o quando ci sono partite nella GW) generiamo formazioni finché ci sono giocatori con match reale;
      // se invece l'intero campionato è in sosta (0 partite per chiunque), generiamo comunque le migliori rose del campionato senza bloccare a 0
      const totalActiveInWholePool = available.filter(c => Boolean(c.activeMatch)).length;
      if (totalActiveInWholePool > 0 && activePlayersInLineup === 0) break;

      picked.forEach(p => usedPlayerSlugsGlobal.add(p.playerSlug));

      // Capitano (+50%)
      const candidatesForCaptain = picked.filter(p => Boolean(p.activeMatch));
      const captainPool = candidatesForCaptain.length > 0 ? [...candidatesForCaptain] : [...picked];
      captainPool.sort((a, b) => (b.projectedScore || b.l15 || 0) - (a.projectedScore || a.l15 || 0));
      const captainId = captainPool[0]?.id;

      const finalStarters = picked.map(p => {
        const isCap = p.id === captainId;
        const baseScore = p.projectedScore > 0 ? p.projectedScore : Number(((p.l15 || p.l5 || 35) * (p.powerMultiplier || 1)).toFixed(1));
        const finalScore = p.activeMatch
          ? (isCap ? Number((p.projectedScore * 1.5).toFixed(1)) : p.projectedScore)
          : (totalActiveInWholePool === 0 ? (isCap ? Number((baseScore * 1.5).toFixed(1)) : baseScore) : 0);

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

  evaluateCardForGw(card, selectedGw, strategy, allowNationalTeamMatches) {
    const allGames = Array.isArray(card.scheduleGames) ? card.scheduleGames : [];
    // Nei campionati di club esclude completamente le partite delle Nazionali
    const allowedGames = allowNationalTeamMatches
      ? allGames
      : allGames.filter(g => !g.isNationalTeam);

    let activeMatch = null;

    if (selectedGw && selectedGw.startDate && selectedGw.endDate) {
      const gwStart = new Date(selectedGw.startDate).getTime();
      const gwEnd = new Date(selectedGw.endDate).getTime();
      activeMatch = allowedGames.find(g => g.timestamp >= gwStart && g.timestamp <= gwEnd) || null;
    } else if (allowedGames.length > 0) {
      const nowMs = Date.now() - 6 * 3600 * 1000;
      activeMatch = allowedGames.find(g => g.timestamp >= nowMs) || null;
    }

    const baseL15 = card.l15 > 0 ? card.l15 : (card.l5 > 0 ? card.l5 : 35);
    const baseL5 = card.l5 > 0 ? card.l5 : baseL15;
    const isCeiling = String(strategy || '').toLowerCase() === 'ceiling';

    let rawExpected = isCeiling
      ? (baseL5 * 0.55) + (baseL15 * 0.25) + ((card.maxRecentScore || baseL5) * 0.20)
      : (baseL15 * 0.55) + (baseL5 * 0.35) + ((card.avgAas || 15) * 0.25);

    const standbyScore = Number(Math.max(15, rawExpected * (card.powerMultiplier || 1)).toFixed(1));

    // Regola Zero-DNP: se non ha partita valida in questa GW per questo torneo, selectionPriority = 0 e projectedScore = 0
    if (!activeMatch) {
      return {
        ...card,
        activeMatch: null,
        isHome: null,
        opponentName: 'Nessuna partita di club in GW',
        availabilityTier: 'dnp',
        isLastResort: true,
        unavailableReason: 'Nessuna partita in questa GW per questo torneo',
        projectedScore: 0,
        standbyScore: standbyScore,
        selectionPriority: 0,
        matchupInsight: `${card.name} (${card.club}) non ha partite valide per questo torneo nella GW selezionata.`
      };
    }

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
        standbyScore: 0,
        selectionPriority: 0,
        matchupInsight: `${card.name}: ${card.baseUnavailableReason}.`
      };
    }

    if (activeMatch.isHome === true) rawExpected *= 1.04;
    if (card.baseFitnessTier === 'rotation') rawExpected *= 0.88;

    const projectedScore = Number(Math.max(15, rawExpected * (card.powerMultiplier || 1)).toFixed(1));
    const priorityTier = card.baseFitnessTier === 'starter' ? 2 : 1;

    const matchLabel = activeMatch.isNationalTeam
      ? `${activeMatch.teamName} (${activeMatch.competitionName})`
      : `${activeMatch.isHome ? 'In casa' : 'In trasferta'} contro ${activeMatch.opponentName}`;

    const insight = `${matchLabel}. Media L15: ${card.l15}, L5: ${card.l5}, minuti medi: ${card.avgMins}'.`;

    return {
      ...card,
      activeMatch: activeMatch,
      isHome: activeMatch.isHome,
      opponentName: activeMatch.opponentName,
      availabilityTier: card.baseFitnessTier === 'starter' ? 'starter' : 'rotation',
      isLastResort: false,
      unavailableReason: '',
      projectedScore: projectedScore,
      standbyScore: standbyScore,
      selectionPriority: priorityTier,
      matchupInsight: insight
    };
  },

  selectBestLineupForSlots(pool, slotsTemplate, requiredInSeason) {
    const selected = [];
    // Blocca SIA l'ID della carta SIA lo slug/nome del giocatore dentro la stessa formazione!
    const usedCardIds = new Set();
    const usedPlayerSlugsInTeam = new Set();

    const sortCandidates = (list, preferInSeason) => {
      return [...list].sort((a, b) => {
        // 1) Chi ha una partita reale nella GW vince SEMPRE su chi non gioca (Zero-DNP)
        const aHasGame = a.selectionPriority > 0 ? 1 : 0;
        const bHasGame = b.selectionPriority > 0 ? 1 : 0;
        if (bHasGame !== aHasGame) return bHasGame - aHasGame;

        // 2) Se richiesto dal torneo SO5, priorità alle carte In-Season
        if (preferInSeason && a.isInSeason !== b.isInSeason) {
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
        }

        // 3) Titolare fisso (2) > Rotazione (1)
        if (b.selectionPriority !== a.selectionPriority) {
          return b.selectionPriority - a.selectionPriority;
        }

        // 4) Punteggio proiettato (o standbyScore se tutto il campionato è in sosta)
        const scoreDiff = (b.projectedScore || b.standbyScore || 0) - (a.projectedScore || a.standbyScore || 0);
        if (scoreDiff !== 0) return scoreDiff;

        return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
      });
    };

    // Seleziona prima i 4/6 ruoli fissi (GK, DEF, MID, FWD) e per ultimo EXTRA così non ruba mai l'unico giocatore di un ruolo singolo
    const orderedSlotIndices = slotsTemplate
      .map((role, idx) => ({ role, idx }))
      .sort((a, b) => (a.role === 'EXTRA' ? 1 : 0) - (b.role === 'EXTRA' ? 1 : 0));

    const tempSelectedByIndex = new Array(slotsTemplate.length);

    for (let step = 0; step < orderedSlotIndices.length; step++) {
      const { role: slotRole, idx: originalIdx } = orderedSlotIndices[step];
      const currentInSeason = Object.values(tempSelectedByIndex).filter(s => s && s.isInSeason).length;
      const remainingSlots = orderedSlotIndices.length - step;
      const needInSeasonNow = (requiredInSeason - currentInSeason) >= remainingSlots;

      const roleCandidates = pool.filter(c => {
        if (usedCardIds.has(c.id)) return false;
        if (usedPlayerSlugsInTeam.has(c.playerSlug)) return false;
        if (slotRole === 'EXTRA') return c.position !== 'GK';
        return c.position === slotRole;
      });

      if (roleCandidates.length === 0) return null;

      let poolToSort = roleCandidates;
      if (needInSeasonNow) {
        const onlyInSeasonWithGame = roleCandidates.filter(c => c.isInSeason && c.selectionPriority > 0);
        const onlyInSeasonAny = roleCandidates.filter(c => c.isInSeason);
        if (onlyInSeasonWithGame.length > 0) {
          poolToSort = onlyInSeasonWithGame;
        } else if (onlyInSeasonAny.length > 0 && roleCandidates.every(c => c.selectionPriority === 0)) {
          poolToSort = onlyInSeasonAny;
        }
      }

      const sorted = sortCandidates(poolToSort, needInSeasonNow || requiredInSeason > 0);
      const chosen = sorted[0];
      if (!chosen) return null;

      usedCardIds.add(chosen.id);
      usedPlayerSlugsInTeam.add(chosen.playerSlug);
      tempSelectedByIndex[originalIdx] = {
        ...chosen,
        slotRole: slotRole
      };
    }

    for (let i = 0; i < tempSelectedByIndex.length; i++) {
      if (!tempSelectedByIndex[i]) return null;
      selected.push(tempSelectedByIndex[i]);
    }

    const finalInSeasonCount = selected.filter(s => s.isInSeason).length;
    if (finalInSeasonCount < requiredInSeason) return null;

    return selected;
  }
};

window.OptimizerEngine = OptimizerEngine;
