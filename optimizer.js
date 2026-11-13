// SorareHub - Club vs National Separation + Sosta Club Fallback + Stack Club Strict XI Filter + Smart IS/Classic
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

    if (compId.includes('contender') || compName.includes('contender')) {
      const allowedContender = (targetScarcity === 'super_rare' || targetScarcity === 'unique')
        ? [...this.CONTENDER_LEAGUES_BASE, ...this.CONTENDER_LEAGUES_HIGH_SCARCITY]
        : this.CONTENDER_LEAGUES_BASE;
      return allowedContender.some(l => cardLeague === l || cardLeague.includes(l));
    }

    if (compId.includes('challenger') || compName.includes('challenger')) {
      return this.CHALLENGER_LEAGUES.some(l => cardLeague === l || cardLeague.includes(l));
    }

    if (compId.includes('champion') || compName.includes('champion')) {
      return this.CHAMPION_LEAGUES.some(l => cardLeague === l || cardLeague.includes(l));
    }

    if (Array.isArray(competition.leagues) && !competition.leagues.includes('ALL')) {
      return competition.leagues.some(l => cardLeague.includes(String(l).toLowerCase()));
    }

    return true;
  },

  getAvailableClubsForCompetition(allCards, competition, scarcity) {
    const targetScarcity = String(scarcity || 'limited').toLowerCase();
    const clubMap = new Map();

    (allCards || []).forEach(card => {
      if (!card || card.scarcity !== targetScarcity || card.isInjuredOrSuspended) return;
      if (!this.isCardEligibleForCompetition(card, competition, targetScarcity)) return;
      if (!card.clubSlug || card.clubSlug === 'no-club') return;

      const existing = clubMap.get(card.clubSlug) || {
        slug: card.clubSlug,
        name: card.club,
        count: 0,
        roles: new Set()
      };
      existing.count++;
      existing.roles.add(card.position);
      clubMap.set(card.clubSlug, existing);
    });

    return Array.from(clubMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },

  // Quando lo Stack Club è attivo, seleziona gli 11 titolari effettivi del club per permettere la scelta solo tra i veri titolari!
  getClubStartingXiPool(clubCards, manualOverrides = {}) {
    const uniquePlayersMap = new Map();
    clubCards.forEach(c => {
      if (c.isInjuredOrSuspended) return;
      if (manualOverrides[c.playerSlug] === 'bench') return;
      // Esclude chi ha già giocato nella GW facendo 0 punti (DNP reale)
      if (c.activeMatch && c.activeMatch.alreadyPlayedScore === 0 && (c.activeMatch.alreadyPlayedMins === 0 || c.activeMatch.alreadyPlayedMins === null)) {
        return;
      }
      const prev = uniquePlayersMap.get(c.playerSlug);
      if (!prev || (c.isInSeason && !prev.isInSeason) || c.powerMultiplier > prev.powerMultiplier) {
        uniquePlayersMap.set(c.playerSlug, c);
      }
    });

    const uniquePlayers = Array.from(uniquePlayersMap.values());
    // Ordina i giocatori del club per stato di titolarità (XI confermato manualmente > Titolare fisso nel club > Minutaggio medio > L15)
    uniquePlayers.sort((a, b) => {
      const aXi = manualOverrides[a.playerSlug] === 'xi' ? 1 : 0;
      const bXi = manualOverrides[b.playerSlug] === 'xi' ? 1 : 0;
      if (bXi !== aXi) return bXi - aXi;

      const aTier = a.baseFitnessTier === 'starter' ? 2 : (a.baseFitnessTier === 'rotation' ? 1 : 0);
      const bTier = b.baseFitnessTier === 'starter' ? 2 : (b.baseFitnessTier === 'rotation' ? 1 : 0);
      if (bTier !== aTier) return bTier - aTier;

      if ((b.avgMins || 0) !== (a.avgMins || 0)) return (b.avgMins || 0) - (a.avgMins || 0);
      return (b.l15 || 0) - (a.l15 || 0);
    });

    // Prende al massimo il portiere titolare (#1 GK) + i migliori 10 giocatori di movimento titolari del club (11 Titolari del Club)
    const allowedXiSlugs = new Set();
    const gks = uniquePlayers.filter(p => p.position === 'GK');
    const outfielders = uniquePlayers.filter(p => p.position !== 'GK');

    if (gks.length > 0) allowedXiSlugs.add(gks[0].playerSlug);
    outfielders.slice(0, 10).forEach(p => allowedXiSlugs.add(p.playerSlug));

    return allowedXiSlugs;
  },

  buildCascadePortfolio(allCards, competition, scarcity, strategy, selectedGw = null, manualOverrides = {}, selectedClubSlug = 'ALL') {
    if (!Array.isArray(allCards) || allCards.length === 0 || !competition) return [];

    const targetScarcity = String(scarcity || 'limited').toLowerCase();
    const isSO7 = competition.format === 'SO7';
    const slotsTemplate = isSO7
      ? ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'EXTRA']
      : ['GK', 'DEF', 'MID', 'FWD', 'EXTRA'];
    const requiredInSeason = Number(competition.inSeasonRequired || 0);

    const compId = String(competition.id || '').toLowerCase();
    const compName = String(competition.name || '').toLowerCase();
    const allowNationalTeamMatches = compId.includes('all_star') || compId.includes('all-star') || compName.includes('all-star');
    const isClubStackActive = Boolean(selectedClubSlug && selectedClubSlug !== 'ALL');

    // 1. Filtra per rarità, competizione, eventuale Stack Club e BLOCCA SEMPRE infortunati e squalificati
    const eligibleCards = allCards.filter(card => {
      if (!card) return false;
      if (card.scarcity !== targetScarcity) return false;
      if (card.isInjuredOrSuspended) return false;
      if (isClubStackActive && card.clubSlug !== selectedClubSlug) return false;
      return this.isCardEligibleForCompetition(card, competition, targetScarcity);
    });

    if (eligibleCards.length < slotsTemplate.length) return [];

    // 2. Valuta ogni carta distinguendo tra match di Club e match di Nazionale
    let evaluatedPool = eligibleCards.map(card =>
      this.evaluateCardForGw(card, selectedGw, strategy, allowNationalTeamMatches, manualOverrides[card.playerSlug] || null)
    );

    // 3. Se è attivo lo Stack Club (es. Benfica), restringe la selezione agli 11 titolari del club (escludendo panchinari e secondo portiere!)
    if (isClubStackActive) {
      const clubXiSlugs = this.getClubStartingXiPool(evaluatedPool, manualOverrides);
      const filteredToXi = evaluatedPool.filter(c => clubXiSlugs.has(c.playerSlug));
      if (filteredToXi.length >= slotsTemplate.length) {
        evaluatedPool = filteredToXi;
      }
    }

    // 4. Verifica se in questa GW ci sono partite attive per questo campionato/stack
    // Esclude SEMPRE chi ha una partita in GW ma è Riserva in Nazionale o ha già fatto 0 pt (selectionPriority === 0)
    const activePlayableCards = evaluatedPool.filter(c => Boolean(c.activeMatch) && c.selectionPriority > 0);
    const activeRoles = new Set(activePlayableCards.map(c => c.position));
    const canBuildFullActiveTeam =
      activePlayableCards.length >= slotsTemplate.length &&
      activeRoles.has('GK') &&
      activeRoles.has('DEF') &&
      activeRoles.has('MID') &&
      activeRoles.has('FWD');

    // Se il campionato è in sosta (es. Contender/Serie A/Liga Portugal durante la sosta Nazionali),
    // genera comunque le squadre con i migliori titolari di club in modalità "⏸️ Sosta Club in questa GW" (rispettando il 4/5 In-Season!)
    const isLeagueOnBreakMode = !canBuildFullActiveTeam;
    const workingPool = canBuildFullActiveTeam
      ? activePlayableCards
      : evaluatedPool.filter(c => {
          // In modalità Sosta Club non mette comunque chi ha già fatto 0 pt in un match giocato o chi è marcato in panchina
          if (manualOverrides[c.playerSlug] === 'bench') return false;
          if (c.activeMatch && c.selectionPriority === 0) return false;
          return true;
        });

    if (workingPool.length < slotsTemplate.length) return [];

    const lineups = [];
    const usedCardIdsGlobal = new Set();
    const maxLineups = isClubStackActive ? 2 : 5;

    for (let rank = 1; rank <= maxLineups; rank++) {
      const available = workingPool.filter(c => !usedCardIdsGlobal.has(c.id));
      if (available.length < slotsTemplate.length) break;

      const picked = this.selectBestLineupForSlots(available, slotsTemplate, requiredInSeason, isLeagueOnBreakMode);
      if (!picked || picked.length < slotsTemplate.length) break;

      picked.forEach(p => usedCardIdsGlobal.add(p.id));

      // Capitano (+50%)
      const captainPool = [...picked].sort((a, b) => {
        const aSc = a.projectedScore > 0 ? a.projectedScore : a.standbyScore;
        const bSc = b.projectedScore > 0 ? b.projectedScore : b.standbyScore;
        return bSc - aSc;
      });
      const captainId = captainPool[0]?.id;

      const finalStarters = picked.map(p => {
        const isCap = p.id === captainId;
        const baseScore = p.projectedScore > 0 ? p.projectedScore : p.standbyScore;
        const finalScore = isCap ? Number((baseScore * 1.5).toFixed(1)) : baseScore;

        return {
          ...p,
          isCaptain: isCap,
          isClubOnBreak: !p.activeMatch,
          projectedScore: finalScore
        };
      });

      const totalProjected = Number(
        finalStarters.reduce((acc, p) => acc + p.projectedScore, 0).toFixed(1)
      );
      const inSeasonCount = finalStarters.filter(p => p.isInSeason).length;
      const activeMatchesCount = finalStarters.filter(p => Boolean(p.activeMatch)).length;

      lineups.push({
        rank: rank,
        rankLabel: isClubStackActive ? `Stack ${picked[0]?.club || ''} #${rank}` : `Squadra #${rank}`,
        format: isSO7 ? 'SO7' : 'SO5',
        inSeasonCount: inSeasonCount,
        activeMatchesCount: activeMatchesCount,
        isLeagueOnBreakMode: isLeagueOnBreakMode,
        totalProjected: totalProjected,
        starters: finalStarters
      });
    }

    return lineups;
  },

  buildDetailedOptaInsight(card, activeMatch, isCeiling, manualStatus, lfIndex, isNationalMatch) {
    const traits = card.tacticalTraits || {};
    const roleMetrics = [];

    if (card.position === 'GK') {
      roleMetrics.push(`🧤 Clean Sheet Club (L5): ${traits.cleanSheets || 0}/5`);
      roleMetrics.push(`👐 Parate totali (L5): ${traits.saves || 0}`);
      if (traits.shotStopper) roleMetrics.push('🛡️ Portiere para-rigori / Alto volume parate');
    } else if (card.position === 'DEF') {
      roleMetrics.push(`🧤 Clean Sheet Club (L5): ${traits.cleanSheets || 0}/5`);
      if (traits.aerialDominator) roleMetrics.push('✈️ Dominatore aereo / Pericoloso sui corner a favore');
      if (traits.defensiveWall) roleMetrics.push('🛡️ Muro difensivo (Contrasti/Intercetti/Respingimenti AA)');
      if ((traits.goals || 0) + (traits.assists || 0) > 0) {
        roleMetrics.push(`⚽ Bonus difensivi L5: ${traits.goals || 0}G / ${traits.assists || 0}A`);
      }
    } else if (card.position === 'MID') {
      roleMetrics.push(`⚽ Bonus offensivi (L5): ${traits.goals || 0} Gol • ${traits.assists || 0} Assist`);
      if (traits.playmakerCreator) roleMetrics.push('🎯 Regia & Passaggi Chiave (Alto indice AA)');
      if (traits.boxToBoxEngine) roleMetrics.push('⚙️ Motore Box-to-Box (Recuperi + Possesso)');
      if (traits.clinicalFinisher) roleMetrics.push('⚡ Inserimenti decisivi in zona bonus');
    } else {
      roleMetrics.push(`⚽ Produzione offensiva (L5): ${traits.goals || 0} Gol • ${traits.assists || 0} Assist`);
      if (traits.clinicalFinisher) roleMetrics.push('⚡ Finalizzatore clinico (Alta conversione Decisive)');
      if (traits.targetPenaltyBox) roleMetrics.push('🔥 Presenza dominante in area & Tiri nello specchio');
      roleMetrics.push(`📈 Base All-Around offensiva: ${card.avgAas} pt`);
    }

    let statusLine = '';
    if (manualStatus === 'bench') {
      statusLine = '🪑 Segnalato IN PANCHINA (escluso dagli 11 titolari)';
    } else if (manualStatus === 'xi') {
      statusLine = '✅ Confermato nell\'11 TITOLARE UFFICIALE';
    } else if (isNationalMatch) {
      const ns = card.natStats || {};
      if (card.natFitnessTier === 'bench_nat') {
        statusLine = `🚫 Riserva in Nazionale (${ns.starterCount || 0} da titolare in Nazionale • ${card.starterCount}/5 nel Club)`;
      } else if (card.natFitnessTier === 'starter') {
        statusLine = `✅ Titolare in Nazionale (${ns.playedCount > 0 ? `${ns.starterCount}/${ns.totalEntries} dal 1' in Naz.` : `Top XI • L15 ${card.l15}`})`;
      } else {
        statusLine = `⚠️ Ballottaggio in Nazionale (Nel Club: ${card.starterCount}/5 dal 1' • ${card.avgMins}' medi)`;
      }
    } else if (card.baseFitnessTier === 'starter') {
      statusLine = `✅ Titolare fisso nel Club (${card.starterCount}/5 dal 1' • ${card.avgMins}' medi)`;
    } else {
      statusLine = `⚠️ Rotazione nel Club (${card.playedCount}/5 presenze • ${card.avgMins}' medi)`;
    }

    const matchContext = activeMatch
      ? (activeMatch.isNationalTeam
        ? `🌍 Match Nazionale: ${activeMatch.teamName} (${activeMatch.competitionName})${activeMatch.alreadyPlayedScore !== null ? ` • Già giocata: ${activeMatch.alreadyPlayedScore} pt` : ''}.`
        : `${activeMatch.isHome ? '🏠 In casa' : '✈️ In trasferta'} vs ${activeMatch.opponentName} (${activeMatch.competitionName})${activeMatch.alreadyPlayedScore !== null ? ` • Già giocata: ${activeMatch.alreadyPlayedScore} pt` : ''}.`)
      : `⏸️ Sosta Club in questa GW (proiezione basata sul rendimento Club: ${lfIndex} pt).`;

    const optaBreakdown = `📊 LineupForge Metriche: L15 ${card.l15} • L5 ${card.l5} • AA ${card.avgAas} pt • Decisive ${card.avgDecisive} pt • Range [${card.minRecentScore}–${card.maxRecentScore}] (σ=${card.stdDev}).`;
    const roleSpecificLine = `🔍 Lettura Ruolo (${card.position}): ${roleMetrics.join(' • ')}.`;

    const strategyNote = isCeiling
      ? `🚀 Indice Ceiling (${lfIndex} pt): massimizza esplosività (${card.maxRecentScore} max) + carta +${card.bonusPct}%.`
      : `🛡️ Indice Floor (${lfIndex} pt): massimizza affidabilità minutaggio e stabilità di rendimento.`;

    return `${statusLine}\n${matchContext}\n${optaBreakdown}\n${roleSpecificLine}\n${strategyNote}`;
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
    }

    const isNationalMatch = Boolean(activeMatch && activeMatch.isNationalTeam);
    const baseL15 = card.l15 > 0 ? card.l15 : (card.l5 > 0 ? card.l5 : 35);
    const baseL5 = card.l5 > 0 ? card.l5 : baseL15;
    const isCeiling = String(strategy || '').toLowerCase() === 'ceiling';

    // Calcolo LineupForge differenziato per Portieri (GK) e Giocatori di movimento:
    // I top GK come Donnarumma non vengono più penalizzati dal basso AA fisiologico del ruolo!
    let lfBaseProjection = 0;
    if (card.position === 'GK') {
      const gkForm = (baseL15 * 0.58) + (baseL5 * 0.42);
      const csBonus = (card.tacticalTraits?.cleanSheets || 0) * 1.8;
      const savesBonus = Math.min(5, (card.tacticalTraits?.saves || 0) * 0.35);
      lfBaseProjection = Math.max(32, gkForm + csBonus + savesBonus);
    } else {
      const minutesFactor = card.avgMins >= 82
        ? 1.05
        : (card.avgMins >= 68 ? 1.00 : (card.avgMins >= 45 ? 0.88 : 0.72));
      const starterConsistencyFactor = card.starterCount >= 4
        ? 1.04
        : (card.starterCount >= 3 ? 1.00 : 0.86);

      if (isCeiling) {
        const upsideComponent = (card.maxRecentScore > 0 ? card.maxRecentScore : baseL5) * 0.28;
        const formComponent = (baseL5 * 0.42) + (baseL15 * 0.30);
        const decisiveBoost = (card.avgDecisive || 15) * 0.12;
        lfBaseProjection = (formComponent + upsideComponent + decisiveBoost) * minutesFactor;
      } else {
        const safeFloor = (baseL15 * 0.48) + (baseL5 * 0.32) + ((card.avgAas || 16) * 0.42);
        const volatilityPenalty = Math.min(5, (card.stdDev || 0) * 0.12);
        lfBaseProjection = Math.max(20, (safeFloor - volatilityPenalty) * minutesFactor * starterConsistencyFactor);
      }
    }

    const standbyScore = Number(Math.max(18, lfBaseProjection * (card.powerMultiplier || 1)).toFixed(1));

    // Caso 1: Nessuna partita in questa GW (es. Sosta Club nei campionati nazionali)
    if (!activeMatch || card.isInjuredOrSuspended) {
      const detailedInsight = this.buildDetailedOptaInsight(card, null, isCeiling, manualStatus, standbyScore, false);
      return {
        ...card,
        activeMatch: null,
        isHome: null,
        opponentName: 'Sosta Club in questa GW',
        availabilityTier: card.baseFitnessTier === 'starter' ? 'starter' : 'rotation',
        manualStatus: manualStatus,
        isLastResort: true,
        unavailableReason: card.isInjuredOrSuspended ? card.baseUnavailableReason : 'Sosta Club in questa GW',
        projectedScore: 0,
        standbyScore: standbyScore,
        selectionPriority: 0,
        clubStandbyPriority: card.baseFitnessTier === 'starter' ? 3 : 2,
        matchupInsight: detailedInsight
      };
    }

    // Caso 2: La partita della GW è GIÀ STATA GIOCATA e il giocatore ha preso 0 pt (panchina/DNP reale, come Pandur in Croazia-Inghilterra!)
    // Oppure in Nazionale è una riserva conclamata (natFitnessTier === 'bench_nat') e non è stato forzato manualmente come 'xi'
    const alreadyDnpInThisGw =
      activeMatch.alreadyPlayedScore !== null &&
      activeMatch.alreadyPlayedScore === 0 &&
      (activeMatch.alreadyPlayedMins === 0 || activeMatch.alreadyPlayedMins === null);

    const isNationalTeamReserve = isNationalMatch && card.natFitnessTier === 'bench_nat' && manualStatus !== 'xi';

    if (alreadyDnpInThisGw || isNationalTeamReserve) {
      const detailedInsight = this.buildDetailedOptaInsight(card, activeMatch, isCeiling, manualStatus, 0, isNationalMatch);
      return {
        ...card,
        activeMatch: activeMatch,
        isHome: activeMatch.isHome,
        opponentName: activeMatch.opponentName,
        availabilityTier: 'dnp',
        manualStatus: manualStatus,
        isLastResort: true,
        unavailableReason: alreadyDnpInThisGw
          ? 'Ha fatto 0 pt (Panchina/DNP) nel match già disputato in questa GW'
          : 'Riserva in Nazionale (non titolare nella sua selezione)',
        projectedScore: 0,
        standbyScore: 0,
        selectionPriority: 0,
        clubStandbyPriority: 0,
        matchupInsight: detailedInsight
      };
    }

    // Caso 3: Se la partita della GW è già stata giocata e il giocatore ha preso un voto reale (> 0), mostra e usa il suo punteggio reale (con bonus carta) o la proiezione LineupForge!
    const homeAwayMultiplier = activeMatch.isHome === true ? 1.05 : 0.985;
    let adjustedProjection = lfBaseProjection * homeAwayMultiplier;

    // Se è una partita di Nazionale e il giocatore in Nazionale è solo in rotazione (es. Cambiaghi / Fetai), riduce la priorità e la proiezione rispetto ai titolari fissi della Nazionale
    if (isNationalMatch && card.natFitnessTier === 'rotation' && manualStatus !== 'xi') {
      adjustedProjection *= 0.82;
    }

    if (manualStatus === 'bench') {
      const benchScore = Number(Math.max(12, adjustedProjection * 0.45 * (card.powerMultiplier || 1)).toFixed(1));
      const detailedInsight = this.buildDetailedOptaInsight(card, activeMatch, isCeiling, 'bench', benchScore, isNationalMatch);
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
        clubStandbyPriority: 1,
        matchupInsight: detailedInsight
      };
    }

    const effectiveTier = isNationalMatch ? card.natFitnessTier : card.baseFitnessTier;
    const priorityTier = (manualStatus === 'xi' || effectiveTier === 'starter') ? 3 : 2;
    const projectedScore = Number(Math.max(18, adjustedProjection * (card.powerMultiplier || 1)).toFixed(1));
    const detailedInsight = this.buildDetailedOptaInsight(card, activeMatch, isCeiling, manualStatus, projectedScore, isNationalMatch);

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
      clubStandbyPriority: priorityTier,
      matchupInsight: detailedInsight
    };
  },

  selectBestLineupForSlots(pool, slotsTemplate, requiredInSeason, isLeagueOnBreakMode = false) {
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
      const inSeasonTargetMet = currentInSeason >= requiredInSeason;
      const mustPickInSeasonNow = !inSeasonTargetMet && (requiredInSeason - currentInSeason) >= remainingSlots;

      const roleCandidates = pool.filter(c => {
        if (usedCardIds.has(c.id)) return false;
        if (usedPlayerSlugsInTeam.has(c.playerSlug)) return false;
        if (slotRole === 'EXTRA') return c.position !== 'GK';
        return c.position === slotRole;
      });

      if (roleCandidates.length === 0) return null;

      let poolToSort = roleCandidates;
      if (mustPickInSeasonNow) {
        const onlyInSeason = roleCandidates.filter(c => c.isInSeason);
        if (onlyInSeason.length === 0) return null;
        poolToSort = onlyInSeason;
      }

      const sorted = [...poolToSort].sort((a, b) => {
        // 1) Se siamo in una GW con partite attive, chi ha partita attiva vince sempre
        if (!isLeagueOnBreakMode) {
          const aHasGame = a.selectionPriority > 0 ? 1 : 0;
          const bHasGame = b.selectionPriority > 0 ? 1 : 0;
          if (bHasGame !== aHasGame) return bHasGame - aHasGame;
        }

        // 2) Se lo stesso giocatore ha sia versione IS che Classic nel pool:
        //    - se la quota 4/5 IS è GIÀ raggiunta, usa la versione CLASSIC per risparmiare la IS per la Squadra successiva!
        //    - se la quota 4/5 IS NON è ancora raggiunta, usa la versione IN-SEASON!
        if (a.playerSlug === b.playerSlug && a.isInSeason !== b.isInSeason) {
          if (inSeasonTargetMet && requiredInSeason > 0) {
            return (a.isInSeason ? 1 : 0) - (b.isInSeason ? 1 : 0);
          }
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
        }

        // 3) Se serve ancora chiudere la quota 4/5 In-Season, privilegia le carte 26/27
        if (!inSeasonTargetMet && requiredInSeason > 0 && a.isInSeason !== b.isInSeason) {
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
        }

        // 4) Priorità di titolarità (Titolare XI > Rotazione > Panchina)
        const aPrio = isLeagueOnBreakMode ? (a.clubStandbyPriority || 2) : a.selectionPriority;
        const bPrio = isLeagueOnBreakMode ? (b.clubStandbyPriority || 2) : b.selectionPriority;
        if (bPrio !== aPrio) return bPrio - aPrio;

        // 5) Penalizza due difensori/portieri della stessa squadra quando non siamo in modalità Stack Club
        const aTeamKey = `${a.activeMatch?.teamName || a.clubSlug}_${a.position}`;
        const bTeamKey = `${b.activeMatch?.teamName || b.clubSlug}_${b.position}`;
        const aPenalty = (a.position === 'DEF' || a.position === 'GK') && selectedTeamPositionKeys.has(aTeamKey) ? 10 : 0;
        const bPenalty = (b.position === 'DEF' || b.position === 'GK') && selectedTeamPositionKeys.has(bTeamKey) ? 10 : 0;

        // 6) Quando la quota 4/5 IS è già raggiunta, favorisce una buona Classic sul 5° slot per risparmiare le In-Season per le formazioni successive
        const aSaveBonus = (inSeasonTargetMet && requiredInSeason > 0 && !a.isInSeason) ? 2.5 : 0;
        const bSaveBonus = (inSeasonTargetMet && requiredInSeason > 0 && !b.isInSeason) ? 2.5 : 0;

        const aScore = (a.projectedScore > 0 ? a.projectedScore : a.standbyScore) - aPenalty + aSaveBonus;
        const bScore = (b.projectedScore > 0 ? b.projectedScore : b.standbyScore) - bPenalty + bSaveBonus;
        if (bScore !== aScore) return bScore - aScore;

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
