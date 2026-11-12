// SorareHub - Official Contender/Challenger Rules + Strict In-Season + Full Opta Tactical Insights + Bench Override
const OptimizerEngine = {
  CHAMPION_LEAGUES: [
    'premier-league',
    'serie-a',
    'laliga',
    'la-liga',
    'primera-division',
    'bundesliga',
    'ligue-1'
  ],

  // Lista ufficiale Sorare Contender (Limited/Rare + espansione Super Rare/Unique)
  CONTENDER_LEAGUES_BASE: [
    'austrian-bundesliga',
    'bundesliga-at',
    'supersport-hnl',
    'prva-hnl',
    'croatian-first-football-league',
    '2-bundesliga',
    '2-bundesliga-de',
    'ligue-2',
    'ligue-2-fr'
  ],
  CONTENDER_LEAGUES_HIGH_SCARCITY: [
    'scottish-premiership',
    'premiership',
    'efl-championship',
    'championship',
    'j1-league',
    'j-league'
  ],

  // Lista ufficiale Sorare Challenger
  CHALLENGER_LEAGUES: [
    'primeira-liga',
    'liga-portugal',
    'eredivisie',
    'jupiler-pro-league',
    'first-division-a',
    'scottish-premiership',
    'premiership',
    'super-lig',
    'turkish-super-lig',
    'danish-superliga',
    'superliga',
    'swiss-super-league',
    'super-league',
    'eliteserien',
    'allsvenskan',
    'ekstraklasa'
  ],

  isCardEligibleForCompetition(card, competition, scarcity) {
    const compId = String(competition.id || '').toLowerCase();
    const compName = String(competition.name || '').toLowerCase();
    const cardLeague = String(card.leagueSlug || '').toLowerCase();
    const targetScarcity = String(scarcity || 'limited').toLowerCase();

    if (competition.u23Only || compId.includes('u23')) {
      return Boolean(card.isU23);
    }

    if (compId.includes('all_star') || compId.includes('all-star') || compName.includes('all-star')) {
      return true;
    }

    // Contender: rigorosamente le leghe ufficiali Sorare Contender
    if (compId.includes('contender') || compName.includes('contender')) {
      const allowedContender = (targetScarcity === 'super_rare' || targetScarcity === 'unique')
        ? [...this.CONTENDER_LEAGUES_BASE, ...this.CONTENDER_LEAGUES_HIGH_SCARCITY]
        : this.CONTENDER_LEAGUES_BASE;
      return allowedContender.some(l => cardLeague === l || cardLeague.includes(l));
    }

    // Challenger: rigorosamente le leghe ufficiali Sorare Challenger
    if (compId.includes('challenger') || compName.includes('challenger')) {
      return this.CHALLENGER_LEAGUES.some(l => cardLeague === l || cardLeague.includes(l));
    }

    // Champion Europe
    if (compId.includes('champion') || compName.includes('champion')) {
      return this.CHAMPION_LEAGUES.some(l => cardLeague === l || cardLeague.includes(l));
    }

    if (Array.isArray(competition.leagues) && !competition.leagues.includes('ALL')) {
      return competition.leagues.some(l => cardLeague.includes(String(l).toLowerCase()));
    }

    return true;
  },

  buildCascadePortfolio(allCards, competition, scarcity, strategy, selectedGw = null, manualOverrides = {}) {
    if (!Array.isArray(allCards) || allCards.length === 0 || !competition) return [];

    const targetScarcity = String(scarcity || 'limited').toLowerCase();
    const isSO7 = competition.format === 'SO7';
    const slotsTemplate = isSO7
      ? ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'EXTRA']
      : ['GK', 'DEF', 'MID', 'FWD', 'EXTRA'];
    const requiredInSeason = Number(competition.inSeasonRequired || 0);

    const compId = String(competition.id || '').toLowerCase();
    const compName = String(competition.name || '').toLowerCase();
    // Le partite delle Nazionali valgono SOLO in All-Star
    const allowNationalTeamMatches = compId.includes('all_star') || compId.includes('all-star') || compName.includes('all-star');

    // 1. Filtra per rarità e competizione ufficiale Sorare
    const eligibleCards = allCards.filter(card => {
      if (!card) return false;
      if (card.scarcity !== targetScarcity) return false;
      return this.isCardEligibleForCompetition(card, competition, targetScarcity);
    });

    if (eligibleCards.length < slotsTemplate.length) return [];

    // 2. Valuta ogni carta con analisi tattica Opta completa e override manuali (XI / Panchina)
    const evaluatedPool = eligibleCards.map(card =>
      this.evaluateCardForGw(card, selectedGw, strategy, allowNationalTeamMatches, manualOverrides[card.playerSlug] || null)
    );

    const lineups = [];
    const usedPlayerSlugsGlobal = new Set();
    const maxLineups = 5;

    for (let rank = 1; rank <= maxLineups; rank++) {
      const available = evaluatedPool.filter(c => !usedPlayerSlugsGlobal.has(c.playerSlug));
      if (available.length < slotsTemplate.length) break;

      // Rispetta RIGOROSAMENTE il requisito In-Season (nessun fallback a formazioni full-Classic nei tornei In-Season!)
      const picked = this.selectBestLineupForSlots(available, slotsTemplate, requiredInSeason);
      if (!picked || picked.length < slotsTemplate.length) break;

      const activePlayersInLineup = picked.filter(p => Boolean(p.activeMatch) && p.selectionPriority > 0).length;
      const totalActiveInWholePool = available.filter(c => Boolean(c.activeMatch) && c.selectionPriority > 0).length;
      if (totalActiveInWholePool > 0 && activePlayersInLineup === 0) break;

      picked.forEach(p => usedPlayerSlugsGlobal.add(p.playerSlug));

      // Capitano (+50%)
      const candidatesForCaptain = picked.filter(p => Boolean(p.activeMatch) && p.selectionPriority > 0);
      const captainPool = candidatesForCaptain.length > 0 ? [...candidatesForCaptain] : [...picked];
      captainPool.sort((a, b) => (b.projectedScore || b.standbyScore || 0) - (a.projectedScore || a.standbyScore || 0));
      const captainId = captainPool[0]?.id;

      const finalStarters = picked.map(p => {
        const isCap = p.id === captainId;
        const baseScore = p.projectedScore > 0 ? p.projectedScore : (totalActiveInWholePool === 0 ? p.standbyScore : 0);
        const finalScore = isCap ? Number((baseScore * 1.5).toFixed(1)) : baseScore;

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

  buildDetailedOptaInsight(card, activeMatch, isCeiling, manualStatus) {
    const traits = card.tacticalTraits || {};
    const traitTags = [];
    if (traits.setPiece) traitTags.push('🎯 Piazzati/Corner');
    if (traits.aerial) traitTags.push('✈️ Gioco aereo');
    if (traits.ballWinner) traitTags.push('🛡️ Recuperi/Intercetti');
    if (traits.clinical) traitTags.push('⚡ Finalizzazione');
    if (traits.cleanSheets > 0) traitTags.push(`🧤 ${traits.cleanSheets} Clean Sheet`);
    if (traits.goals > 0 || traits.assists > 0) traitTags.push(`⚽ ${traits.goals || 0}G / ${traits.assists || 0}A (L5)`);
    if (card.position === 'GK' && traits.saves > 0) traitTags.push(`👐 ${traits.saves} parate (L5)`);

    let statusLine = '';
    if (manualStatus === 'bench') {
      statusLine = '🪑 Segnalato IN PANCHINA (ingresso a gara in corso)';
    } else if (manualStatus === 'xi') {
      statusLine = '✅ Confermato TITOLARE XI';
    } else if (card.baseFitnessTier === 'starter') {
      statusLine = `✅ Titolare fisso (${card.starterCount}/5 dal 1' • ${card.avgMins}' medi)`;
    } else if (card.baseFitnessTier === 'rotation') {
      statusLine = `⚠️ In rotazione (${card.playedCount}/5 presenze • ${card.avgMins}' medi)`;
    } else {
      statusLine = `⏸️ ${card.baseUnavailableReason || 'Minutaggio ridotto nelle ultime 5'}`;
    }

    const matchContext = activeMatch
      ? (activeMatch.isNationalTeam
        ? `🌍 Match Nazionale: ${activeMatch.teamName} (${activeMatch.competitionName}).`
        : `${activeMatch.isHome ? '🏠 Match in casa' : '✈️ Match in trasferta'} vs ${activeMatch.opponentName} (${activeMatch.competitionName}).`)
      : `⏸️ Nessuna partita in calendario per questo torneo nella GW selezionata.`;

    const optaBreakdown = `📊 Opta L5: AA ${card.avgAas} pt/gara • Decisive ${card.avgDecisive} pt/gara • Picco max ${card.maxRecentScore} pt (σ=${card.stdDev}).`;
    const traitsLine = traitTags.length > 0
      ? `🔍 Profilo tattico: ${traitTags.join(' • ')}.`
      : `🔍 Profilo tattico: contributo equilibrato sul possesso.`;

    const strategyNote = isCeiling
      ? `🚀 Strategia Ceiling: valorizza picchi decisivi (${card.maxRecentScore} pt) e bonus carta +${card.bonusPct}%.`
      : `🛡️ Strategia Floor: premia costanza All-Around (${card.avgAas} AA) e bassa varianza (σ=${card.stdDev}).`;

    return `${statusLine}\n${matchContext}\n${optaBreakdown}\n${traitsLine}\n${strategyNote}`;
  },

  evaluateCardForGw(card, selectedGw, strategy, allowNationalTeamMatches, manualStatus = null) {
    const allGames = Array.isArray(card.scheduleGames) ? card.scheduleGames : [];
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
    const detailedInsight = this.buildDetailedOptaInsight(card, activeMatch, isCeiling, manualStatus);

    if (!activeMatch) {
      return {
        ...card,
        activeMatch: null,
        isHome: null,
        opponentName: 'Nessuna partita',
        availabilityTier: 'dnp',
        manualStatus: manualStatus,
        isLastResort: true,
        unavailableReason: 'Nessuna partita in questa GW per questo torneo',
        projectedScore: 0,
        standbyScore: standbyScore,
        selectionPriority: 0,
        matchupInsight: detailedInsight
      };
    }

    if (card.baseUnavailableReason && (card.baseUnavailableReason.includes('Infortunato') || card.baseUnavailableReason.includes('Squalificato'))) {
      return {
        ...card,
        activeMatch: activeMatch,
        isHome: activeMatch.isHome,
        opponentName: activeMatch.opponentName,
        availabilityTier: 'dnp',
        manualStatus: manualStatus,
        isLastResort: true,
        unavailableReason: card.baseUnavailableReason,
        projectedScore: 0,
        standbyScore: 0,
        selectionPriority: 0,
        matchupInsight: detailedInsight
      };
    }

    // Se l'utente ha segnato il giocatore in PANCHINA (es. formazioni ufficiali uscite), declassa la priorità sotto i titolari reali
    if (manualStatus === 'bench') {
      const benchScore = Number(Math.max(10, rawExpected * 0.45 * (card.powerMultiplier || 1)).toFixed(1));
      return {
        ...card,
        activeMatch: activeMatch,
        isHome: activeMatch.isHome,
        opponentName: activeMatch.opponentName,
        availabilityTier: 'bench',
        manualStatus: 'bench',
        isLastResort: false,
        unavailableReason: '',
        projectedScore: benchScore,
        standbyScore: benchScore,
        selectionPriority: 1,
        matchupInsight: detailedInsight
      };
    }

    if (activeMatch.isHome === true) rawExpected *= 1.04;
    if (manualStatus !== 'xi' && card.baseFitnessTier === 'rotation') rawExpected *= 0.88;

    const projectedScore = Number(Math.max(15, rawExpected * (card.powerMultiplier || 1)).toFixed(1));
    const priorityTier = (manualStatus === 'xi' || card.baseFitnessTier === 'starter') ? 3 : 2;

    return {
      ...card,
      activeMatch: activeMatch,
      isHome: activeMatch.isHome,
      opponentName: activeMatch.opponentName,
      availabilityTier: priorityTier === 3 ? 'starter' : 'rotation',
      manualStatus: manualStatus,
      isLastResort: false,
      unavailableReason: '',
      projectedScore: projectedScore,
      standbyScore: standbyScore,
      selectionPriority: priorityTier,
      matchupInsight: detailedInsight
    };
  },

  selectBestLineupForSlots(pool, slotsTemplate, requiredInSeason) {
    const usedCardIds = new Set();
    const usedPlayerSlugsInTeam = new Set();
    const selectedTeamPositionKeys = new Set();

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

      const sorted = [...poolToSort].sort((a, b) => {
        // 1) Chi ha una partita valida nella GW ha sempre la precedenza
        const aHasGame = a.selectionPriority > 0 ? 1 : 0;
        const bHasGame = b.selectionPriority > 0 ? 1 : 0;
        if (bHasGame !== aHasGame) return bHasGame - aHasGame;

        // 2) Se il torneo richiede carte In-Season, dà precedenza alle 26/27
        if ((needInSeasonNow || requiredInSeason > 0) && a.isInSeason !== b.isInSeason) {
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
        }

        // 3) Titolare XI (3) > Rotazione (2) > Panchina manuale (1) > DNP (0)
        if (b.selectionPriority !== a.selectionPriority) {
          return b.selectionPriority - a.selectionPriority;
        }

        // 4) Penalizza due difensori/portieri della stessa squadra nella stessa partita (es. Cucurella + Grimaldo nella Spagna)
        const aTeamKey = `${a.activeMatch?.teamName || a.clubSlug}_${a.position}`;
        const bTeamKey = `${b.activeMatch?.teamName || b.clubSlug}_${b.position}`;
        const aPenalty = (a.position === 'DEF' || a.position === 'GK') && selectedTeamPositionKeys.has(aTeamKey) ? 12 : 0;
        const bPenalty = (b.position === 'DEF' || b.position === 'GK') && selectedTeamPositionKeys.has(bTeamKey) ? 12 : 0;

        const aEffScore = (a.projectedScore || a.standbyScore || 0) - aPenalty;
        const bEffScore = (b.projectedScore || b.standbyScore || 0) - bPenalty;
        if (bEffScore !== aEffScore) return bEffScore - aEffScore;

        return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
      });

      const chosen = sorted[0];
      if (!chosen) return null;

      usedCardIds.add(chosen.id);
      usedPlayerSlugsInTeam.add(chosen.playerSlug);
      selectedTeamPositionKeys.add(`${chosen.activeMatch?.teamName || chosen.clubSlug}_${chosen.position}`);

      tempSelectedByIndex[originalIdx] = {
        ...chosen,
        slotRole: slotRole
      };
    }

    const selected = [];
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
