// SorareHub - LineupForge Projection Engine + Zero-DNP & Injury Hard-Block + Club Stack + Smart IS/Classic Dual-Version
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

  // Restituisce l'elenco di tutti i Club disponibili nella galleria per la competizione e rarità selezionate (per il filtro Stack Club)
  getAvailableClubsForCompetition(allCards, competition, scarcity) {
    const targetScarcity = String(scarcity || 'limited').toLowerCase();
    const clubMap = new Map();

    (allCards || []).forEach(card => {
      if (!card || card.scarcity !== targetScarcity) return;
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

    // 1. Filtra per rarità, competizione, eventuale Stack Club e BLOCCA SEMPRE gli infortunati/squalificati
    const eligibleCards = allCards.filter(card => {
      if (!card) return false;
      if (card.scarcity !== targetScarcity) return false;
      if (card.isInjuredOrSuspended) return false; // MAI consigliare giocatori infortunati o squalificati!
      if (isClubStackActive && card.clubSlug !== selectedClubSlug) return false;
      return this.isCardEligibleForCompetition(card, competition, targetScarcity);
    });

    if (eligibleCards.length < slotsTemplate.length) return [];

    // 2. Valuta ogni carta con il modello LineupForge sulla finestra completa della Gameweek
    const evaluatedPool = eligibleCards.map(card =>
      this.evaluateCardForGw(card, selectedGw, strategy, allowNationalTeamMatches, manualOverrides[card.playerSlug] || null)
    );

    // 3. Regola Zero-DNP: tieni SOLO giocatori che hanno effettivamente una partita nella GW selezionata
    // (Eccezione unica: se l'utente ha selezionato uno Stack Club specifico che è in sosta, permette di vedere lo stack di quel club)
    const cardsWithMatchInGw = evaluatedPool.filter(c => Boolean(c.activeMatch) && c.selectionPriority > 0);
    const workingPool = cardsWithMatchInGw.length >= slotsTemplate.length
      ? cardsWithMatchInGw
      : (isClubStackActive ? evaluatedPool : []);

    if (workingPool.length < slotsTemplate.length) return [];

    const lineups = [];
    const usedCardIdsGlobal = new Set();
    const maxLineups = 5;

    for (let rank = 1; rank <= maxLineups; rank++) {
      // Sfrutta tutte le carte della galleria: esclude le singole carte (id) già usate,
      // così se hai una versione IS e una Classic dello stesso giocatore puoi usare la seconda in un'altra formazione!
      const available = workingPool.filter(c => !usedCardIdsGlobal.has(c.id));
      if (available.length < slotsTemplate.length) break;

      const picked = this.selectBestLineupForSlots(available, slotsTemplate, requiredInSeason);
      if (!picked || picked.length < slotsTemplate.length) break;

      // Garantisce che ogni singolo giocatore della formazione (incluso il GK!) abbia un match reale quando non siamo in modalità Stack Club forzato in sosta
      if (!isClubStackActive && picked.some(p => !p.activeMatch)) {
        break;
      }

      picked.forEach(p => usedCardIdsGlobal.add(p.id));

      // Capitano (+50%)
      const captainPool = [...picked].sort((a, b) => (b.projectedScore || b.standbyScore || 0) - (a.projectedScore || a.standbyScore || 0));
      const captainId = captainPool[0]?.id;

      const finalStarters = picked.map(p => {
        const isCap = p.id === captainId;
        const baseScore = p.projectedScore > 0 ? p.projectedScore : p.standbyScore;
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
      const activeMatchesCount = finalStarters.filter(p => Boolean(p.activeMatch)).length;

      lineups.push({
        rank: rank,
        rankLabel: isClubStackActive ? `Stack ${picked[0]?.club || ''} #${rank}` : `Squadra #${rank}`,
        format: isSO7 ? 'SO7' : 'SO5',
        inSeasonCount: inSeasonCount,
        activeMatchesCount: activeMatchesCount,
        totalProjected: totalProjected,
        starters: finalStarters
      });
    }

    return lineups;
  },

  // Specchietto Tattico Opta differenziato per ruolo (senza "Battitore piazzati" su difensori centrali e senza Clean Sheet su CC e ATT)
  buildDetailedOptaInsight(card, activeMatch, isCeiling, manualStatus, lfIndex) {
    const traits = card.tacticalTraits || {};
    const roleMetrics = [];

    if (card.position === 'GK') {
      roleMetrics.push(`🧤 Clean Sheet (L5): ${traits.cleanSheets || 0}/5`);
      roleMetrics.push(`👐 Parate totali (L5): ${traits.saves || 0}`);
      if (traits.shotStopper) roleMetrics.push('🛡️ Alto volume parate AA');
    } else if (card.position === 'DEF') {
      roleMetrics.push(`🧤 Clean Sheet (L5): ${traits.cleanSheets || 0}/5`);
      if (traits.aerialDominator) roleMetrics.push('✈️ Dominatore aereo / Pericoloso sui corner a favore');
      if (traits.defensiveWall) roleMetrics.push('🛡️ Muro difensivo (Contrasti/Intercetti/Respingimenti AA)');
      if ((traits.goals || 0) + (traits.assists || 0) > 0) {
        roleMetrics.push(`⚽ Bonus difensivi L5: ${traits.goals || 0}G / ${traits.assists || 0}A`);
      }
    } else if (card.position === 'MID') {
      // Nessuna voce Clean Sheet per i Centrocampisti!
      roleMetrics.push(`⚽ Bonus offensivi (L5): ${traits.goals || 0} Gol • ${traits.assists || 0} Assist`);
      if (traits.playmakerCreator) roleMetrics.push('🎯 Regia & Passaggi Chiave (Alto indice AA)');
      if (traits.boxToBoxEngine) roleMetrics.push('⚙️ Motore Box-to-Box (Recuperi + Possesso)');
      if (traits.clinicalFinisher) roleMetrics.push('⚡ Inserimenti decisivi in zona bonus');
    } else {
      // ATT (FWD): Nessuna voce Clean Sheet per gli Attaccanti!
      roleMetrics.push(`⚽ Produzione offensiva (L5): ${traits.goals || 0} Gol • ${traits.assists || 0} Assist`);
      if (traits.clinicalFinisher) roleMetrics.push('⚡ Finalizzatore clinico (Alta conversione Decisive)');
      if (traits.targetPenaltyBox) roleMetrics.push('🔥 Presenza dominante in area & Tiri nello specchio');
      roleMetrics.push(`📈 Base All-Around offensiva: ${card.avgAas} pt`);
    }

    let statusLine = '';
    if (manualStatus === 'bench') {
      statusLine = '🪑 Segnalato IN PANCHINA (subentro previsto / minutaggio ridotto)';
    } else if (manualStatus === 'xi') {
      statusLine = '✅ Confermato TITOLARE XI';
    } else if (card.baseFitnessTier === 'starter') {
      statusLine = `✅ Titolare affidabile (${card.starterCount}/5 dal 1' • ${card.avgMins}' medi)`;
    } else {
      statusLine = `⚠️ Rotazione / Ballottaggio (${card.playedCount}/5 presenze • ${card.avgMins}' medi)`;
    }

    const matchContext = activeMatch
      ? (activeMatch.isNationalTeam
        ? `🌍 Match Nazionale: ${activeMatch.teamName} (${activeMatch.competitionName})${activeMatch.alreadyPlayedScore !== null ? ` • Già giocata: ${activeMatch.alreadyPlayedScore} pt` : ''}.`
        : `${activeMatch.isHome ? '🏠 In casa' : '✈️ In trasferta'} vs ${activeMatch.opponentName} (${activeMatch.competitionName})${activeMatch.alreadyPlayedScore !== null ? ` • Già giocata: ${activeMatch.alreadyPlayedScore} pt` : ''}.`)
      : `⏸️ Nessuna partita in questa GW.`;

    const optaBreakdown = `📊 LineupForge Metriche: AA medio ${card.avgAas} pt • Decisive medio ${card.avgDecisive} pt • Range L5 [${card.minRecentScore}–${card.maxRecentScore} pt] (σ=${card.stdDev}).`;
    const roleSpecificLine = `🔍 Lettura Ruolo (${card.position}): ${roleMetrics.join(' • ')}.`;

    const strategyNote = isCeiling
      ? `🚀 Indice Ceiling (${lfIndex} pt): massimizza esplosività (${card.maxRecentScore} max) + carta +${card.bonusPct}%.`
      : `🛡️ Indice Floor (${lfIndex} pt): massimizza minutaggio (${card.avgMins}'), base AA (${card.avgAas}) e stabilità.`;

    return `${statusLine}\n${matchContext}\n${optaBreakdown}\n${roleSpecificLine}\n${strategyNote}`;
  },

  // Modello di proiezione ispirato a LineupForge:
  // Combina Minutaggio Reale (Minutes Factor), Base All-Around, Frequenza Decisive, Fattore Campo e Varianza (Floor vs Ceiling)
  evaluateCardForGw(card, selectedGw, strategy, allowNationalTeamMatches, manualStatus = null) {
    const allGames = Array.isArray(card.scheduleGames) ? card.scheduleGames : [];
    const allowedGames = allowNationalTeamMatches
      ? allGames
      : allGames.filter(g => !g.isNationalTeam);

    let activeMatch = null;
    if (selectedGw && selectedGw.startDate && selectedGw.endDate) {
      const gwStart = new Date(selectedGw.startDate).getTime();
      const gwEnd = new Date(selectedGw.endDate).getTime();
      // Considera TUTTE le partite che cadono nell'arco temporale della GW (comprese quelle giocate ieri!)
      activeMatch = allowedGames.find(g => g.timestamp >= gwStart && g.timestamp <= gwEnd) || null;
    }

    const baseL15 = card.l15 > 0 ? card.l15 : (card.l5 > 0 ? card.l5 : 35);
    const baseL5 = card.l5 > 0 ? card.l5 : baseL15;
    const isCeiling = String(strategy || '').toLowerCase() === 'ceiling';

    // Fattore affidabilità minutaggio LineupForge (0.65 -> 1.06)
    const minutesFactor = card.avgMins >= 82
      ? 1.05
      : (card.avgMins >= 68 ? 1.00 : (card.avgMins >= 45 ? 0.88 : 0.72));

    const starterConsistencyFactor = card.starterCount >= 4
      ? 1.04
      : (card.starterCount >= 3 ? 1.00 : 0.86);

    // Calcolo separato Floor (stabilità AA + L15) vs Ceiling (esplosività Decisive + picco L5)
    let lfBaseProjection = 0;
    if (isCeiling) {
      const upsideComponent = (card.maxRecentScore > 0 ? card.maxRecentScore : baseL5) * 0.28;
      const formComponent = (baseL5 * 0.42) + (baseL15 * 0.30);
      const decisiveBoost = (card.avgDecisive || 15) * 0.12;
      lfBaseProjection = (formComponent + upsideComponent + decisiveBoost) * minutesFactor;
    } else {
      const safeFloor = (baseL15 * 0.48) + (baseL5 * 0.32) + ((card.avgAas || 16) * 0.45);
      const volatilityPenalty = Math.min(6, (card.stdDev || 0) * 0.15);
      lfBaseProjection = Math.max(20, (safeFloor - volatilityPenalty) * minutesFactor * starterConsistencyFactor);
    }

    const standbyScore = Number(Math.max(15, lfBaseProjection * (card.powerMultiplier || 1)).toFixed(1));

    if (!activeMatch || card.isInjuredOrSuspended) {
      const detailedInsight = this.buildDetailedOptaInsight(card, activeMatch, isCeiling, manualStatus, standbyScore);
      return {
        ...card,
        activeMatch: null,
        isHome: null,
        opponentName: 'Nessuna partita in GW',
        availabilityTier: 'dnp',
        manualStatus: manualStatus,
        isLastResort: true,
        unavailableReason: card.isInjuredOrSuspended ? card.baseUnavailableReason : 'Nessuna partita nella GW selezionata',
        projectedScore: 0,
        standbyScore: standbyScore,
        selectionPriority: 0,
        matchupInsight: detailedInsight
      };
    }

    // Fattore campo LineupForge (+5.5% in casa, -2% in trasferta)
    const homeAwayMultiplier = activeMatch.isHome === true ? 1.055 : 0.985;
    let adjustedProjection = lfBaseProjection * homeAwayMultiplier;

    if (manualStatus === 'bench') {
      const benchScore = Number(Math.max(12, adjustedProjection * 0.45 * (card.powerMultiplier || 1)).toFixed(1));
      const detailedInsight = this.buildDetailedOptaInsight(card, activeMatch, isCeiling, 'bench', benchScore);
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

    const projectedScore = Number(Math.max(18, adjustedProjection * (card.powerMultiplier || 1)).toFixed(1));
    const priorityTier = (manualStatus === 'xi' || card.baseFitnessTier === 'starter') ? 3 : 2;
    const detailedInsight = this.buildDetailedOptaInsight(card, activeMatch, isCeiling, manualStatus, projectedScore);

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

  // Selezione intelligente degli slot con gestione ottimale delle doppie versioni (IS vs Classic):
  // - Nei primi 4 slot (quando serve raggiungere il requisito 4/5 In-Season) privilegia la versione In-Season.
  // - Quando i 4/5 In-Season sono già coperti, sul 5° slot ("jolly Classic") privilegia la versione Classic (così risparmia la carta In-Season dello stesso giocatore per la formazione successiva!).
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

      // Individua quali giocatori hanno SIA una carta In-Season SIA una carta Classic ancora disponibili nel pool
      const playerHasBothVersions = new Set();
      const seenIs = new Set();
      const seenClassic = new Set();
      poolToSort.forEach(c => {
        if (c.isInSeason) seenIs.add(c.playerSlug);
        else seenClassic.add(c.playerSlug);
      });
      seenIs.forEach(slug => {
        if (seenClassic.has(slug)) playerHasBothVersions.add(slug);
      });

      const sorted = [...poolToSort].sort((a, b) => {
        // 1) Chi ha una partita reale nella GW vince sempre
        const aHasGame = a.selectionPriority > 0 ? 1 : 0;
        const bHasGame = b.selectionPriority > 0 ? 1 : 0;
        if (bHasGame !== aHasGame) return bHasGame - aHasGame;

        // 2) Se lo stesso identico calciatore ha sia versione IS che Classic nel pool:
        //    - se la quota 4/5 IS è GIÀ raggiunta (inSeasonTargetMet), usa la versione CLASSIC per risparmiare la IS per la Squadra successiva!
        //    - se la quota 4/5 IS NON è ancora raggiunta, usa la versione IN-SEASON!
        if (a.playerSlug === b.playerSlug && a.isInSeason !== b.isInSeason) {
          if (inSeasonTargetMet && requiredInSeason > 0) {
            return (a.isInSeason ? 1 : 0) - (b.isInSeason ? 1 : 0); // Preferisce Classic (isInSeason = false)
          }
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0); // Preferisce In-Season
        }

        // 3) Se ci serve ancora chiudere la quota In-Season, privilegia le carte 26/27
        if (!inSeasonTargetMet && requiredInSeason > 0 && a.isInSeason !== b.isInSeason) {
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
        }

        // 4) Titolare XI (3) > Rotazione (2) > Panchina manuale (1)
        if (b.selectionPriority !== a.selectionPriority) {
          return b.selectionPriority - a.selectionPriority;
        }

        // 5) Evita conflitti di ballottaggio interno (es. due portieri o due terzini della stessa squadra)
        const aTeamKey = `${a.activeMatch?.teamName || a.clubSlug}_${a.position}`;
        const bTeamKey = `${b.activeMatch?.teamName || b.clubSlug}_${b.position}`;
        const aPenalty = (a.position === 'DEF' || a.position === 'GK') && selectedTeamPositionKeys.has(aTeamKey) ? 12 : 0;
        const bPenalty = (b.position === 'DEF' || b.position === 'GK') && selectedTeamPositionKeys.has(bTeamKey) ? 12 : 0;

        // 6) Se la quota 4/5 IS è già raggiunta, dà un leggero bonus alle carte Classic per preservare le In-Season per le formazioni #2, #3...
        const aSaveBonus = (inSeasonTargetMet && requiredInSeason > 0 && !a.isInSeason) ? 2.5 : 0;
        const bSaveBonus = (inSeasonTargetMet && requiredInSeason > 0 && !b.isInSeason) ? 2.5 : 0;

        const aEffScore = (a.projectedScore || a.standbyScore || 0) - aPenalty + aSaveBonus;
        const bEffScore = (b.projectedScore || b.standbyScore || 0) - bPenalty + bSaveBonus;
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
