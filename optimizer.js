// SorareHub - Strict Tournament/Cup Membership (UCL vs UEL/UECL vs Domestic Leagues) + Verified National Callups
const OptimizerEngine = {
  CHAMPION_DOMESTIC_LEAGUES: [
    'premier-league-gb-eng', 'premier-league',
    'serie-a-it', 'serie-a',
    'laliga-es', 'laliga', 'la-liga', 'primera-division-es', 'primera-division',
    'bundesliga-de', 'bundesliga',
    'ligue-1-fr', 'ligue-1'
  ],

  CONTENDER_LEAGUES_BASE: [
    'bundesliga-at', 'austrian-bundesliga',
    'supersport-hnl', 'prva-hnl', 'croatian-first-football-league', '1-hnl-hr',
    '2-bundesliga-de', '2-bundesliga',
    'ligue-2-fr', 'ligue-2'
  ],
  CONTENDER_LEAGUES_HIGH_SCARCITY: [
    'premiership-gb-sct', 'scottish-premiership',
    'championship-gb-eng', 'efl-championship', 'championship',
    'j1-league-jp', 'j1-league'
  ],

  CHALLENGER_LEAGUES: [
    'primeira-liga-pt', 'primeira-liga', 'liga-portugal',
    'eredivisie-nl', 'eredivisie',
    'jupiler-pro-league-be', 'jupiler-pro-league', 'first-division-a',
    'premiership-gb-sct', 'scottish-premiership',
    'super-lig-tr', 'super-lig', 'turkish-super-lig',
    'superliga-dk', 'danish-superliga',
    'super-league-ch', 'swiss-super-league',
    'eliteserien-no', 'eliteserien',
    'allsvenskan', 'ekstraklasa-pl', 'ekstraklasa'
  ],

  // Squadre partecipanti alla UEFA Champions League (esclude rigorosamente i club dei campionati nazionali che NON fanno la Champions!)
  UCL_CLUB_EXACT_MATCHES: [
    'real-madrid', 'barcelona', 'fc-barcelona', 'atletico-madrid', 'club-atletico-de-madrid', 'girona', 'athletic-club', 'villarreal',
    'manchester-city', 'arsenal', 'liverpool', 'aston-villa', 'chelsea', 'newcastle', 'tottenham',
    'inter', 'internazionale', 'fc-internazionale-milano', 'milan', 'ac-milan', 'juventus', 'atalanta', 'bologna', 'napoli',
    'bayern', 'fc-bayern-munchen', 'leverkusen', 'bayer-04-leverkusen', 'dortmund', 'borussia-dortmund', 'leipzig', 'rb-leipzig', 'stuttgart', 'vfb-stuttgart', 'eintracht-frankfurt',
    'paris-saint-germain', 'psg', 'monaco', 'as-monaco', 'brest', 'stade-brestois', 'lille', 'losc-lille', 'marseille', 'olympique-de-marseille',
    'benfica', 'sl-benfica', 'sporting', 'sporting-cp', 'porto', 'fc-porto',
    'psv', 'feyenoord', 'ajax', 'afc-ajax',
    'club-brugge', 'celtic', 'celtic-fc', 'sturm-graz', 'salzburg', 'fc-red-bull-salzburg', 'dinamo-zagreb', 'gnk-dinamo-zagreb',
    'shakhtar', 'sparta-praha', 'slavia-praha', 'young-boys', 'crvena-zvezda', 'slovan-bratislava', 'galatasaray'
  ],

  // Squadre partecipanti a UEFA Europa League / Conference League
  UEL_UECL_CLUB_EXACT_MATCHES: [
    'roma', 'as-roma', 'lazio', 'ss-lazio', 'fiorentina', 'acf-fiorentina',
    'real-sociedad', 'real-betis', 'manchester-united',
    'lyon', 'olympique-lyonnais', 'nice', 'ogc-nice', 'lens', 'rc-lens', 'strasbourg',
    'hoffenheim', 'freiburg', 'sc-freiburg', 'mainz',
    'az', 'az-alkmaar', 'twente', 'fc-twente', 'utrecht',
    'braga', 'sc-braga', 'vitoria-guimaraes',
    'anderlecht', 'rsc-anderlecht', 'union-saint-gilloise', 'gent', 'kaa-gent', 'genk', 'krc-genk',
    'rangers', 'rangers-fc', 'hearts',
    'olympiacos', 'paok', 'panathinaikos', 'besiktas', 'fenerbahce', 'trabzonspor',
    'midtjylland', 'fc-kobenhavn', 'bodo-glimt', 'malmo', 'elfsborg',
    'rapid', 'sk-rapid', 'lask', 'lugano', 'servette', 'basel', 'legia', 'jagiellonia'
  ],

  isCardEligibleForCompetition(card, competition, scarcity) {
    const compId = String(competition.id || '').toLowerCase();
    const compName = String(competition.name || '').toLowerCase();
    const cardLeague = String(card.leagueSlug || '').toLowerCase();
    const clubSlug = String(card.clubSlug || '').toLowerCase();
    const clubComps = Array.isArray(card.activeClubCompetitions) ? card.activeClubCompetitions : [cardLeague];
    const targetScarcity = String(scarcity || 'limited').toLowerCase();

    // 1) Under 23
    if (competition.u23Only || compId.includes('u23')) {
      return Boolean(card.isU23);
    }

    // 2) All-Star
    if (compId.includes('all_star') || compId.includes('all-star') || compName.includes('all-star')) {
      return true;
    }

    // 3) CHAMPIONS EUROPE — UEFA Champions League (controllato PRIMA di qualsiasi altro "champion"!)
    if (competition.isUefaChampions || compId === 'champions_europe_classic_so7' || compId.includes('ucl')) {
      const hasUclInSchedule = clubComps.some(c => c.includes('champions-league') || c.includes('ucl'));
      const isKnownUclClub = this.UCL_CLUB_EXACT_MATCHES.some(k => clubSlug === k || clubSlug.includes(k));
      return hasUclInSchedule || isKnownUclClub;
    }

    // 4) CONTENDER EUROPE — UEFA Europa League & Conference League (controllato PRIMA di "contender" domestico!)
    if (competition.isUefaContender || compId === 'contender_europe_classic_so7' || compId.includes('uel')) {
      const hasUelInSchedule = clubComps.some(c => c.includes('europa-league') || c.includes('conference-league'));
      const isKnownUelClub = this.UEL_UECL_CLUB_EXACT_MATCHES.some(k => clubSlug === k || clubSlug.includes(k));
      return hasUelInSchedule || isKnownUelClub;
    }

    // 5) Contender Domestico (Austria, Croazia, 2. Bundesliga, Ligue 2)
    if (compId === 'contender_in_season' || (compId.includes('contender') && !compId.includes('europe'))) {
      const allowedContender = (targetScarcity === 'super_rare' || targetScarcity === 'unique')
        ? [...this.CONTENDER_LEAGUES_BASE, ...this.CONTENDER_LEAGUES_HIGH_SCARCITY]
        : this.CONTENDER_LEAGUES_BASE;
      return allowedContender.some(l => cardLeague === l || cardLeague.includes(l));
    }

    // 6) Challenger Domestico
    if (compId.includes('challenger')) {
      return this.CHALLENGER_LEAGUES.some(l => cardLeague === l || cardLeague.includes(l));
    }

    // 7) Champion Europe Domestico (Top 5 Campionati)
    if (compId === 'champion_europe_classic_so7' || compId === 'champion_europe') {
      return this.CHAMPION_DOMESTIC_LEAGUES.some(l => cardLeague === l || cardLeague.includes(l));
    }

    // 8) Singolo Campionato Nazionale specifico (Premier League, Serie A, LaLiga, Bundesliga, Ligue 1, EFL Championship, Liga Portugal, Eredivisie, JPL, Scottish, MLS, J1, K1)
    if (Array.isArray(competition.leagues) && !competition.leagues.includes('ALL')) {
      return competition.leagues.some(targetLeague => {
        const tl = String(targetLeague).toLowerCase();
        // Evita falsi positivi tra "bundesliga-de" e "2-bundesliga-de" o "bundesliga-at"!
        if (tl === 'bundesliga' || tl === 'bundesliga-de') {
          return (cardLeague === 'bundesliga' || cardLeague === 'bundesliga-de') && !cardLeague.includes('2-bundesliga') && !cardLeague.includes('at');
        }
        if (tl === 'ligue-1' || tl === 'ligue-1-fr') {
          return (cardLeague === 'ligue-1' || cardLeague === 'ligue-1-fr') && !cardLeague.includes('ligue-2');
        }
        return cardLeague === tl || cardLeague.includes(tl);
      });
    }

    return true;
  },

  isGameValidForCompetition(game, card, competition) {
    if (!game) return false;
    const compId = String(competition.id || '').toLowerCase();
    const gameCompSlug = String(game.competitionSlug || '').toLowerCase();

    // Partite delle Nazionali ammesse SOLO in All-Star e Under 23
    if (game.isNationalTeam) {
      return Boolean(competition.allowNationalTeams || compId.includes('all_star') || compId.includes('u23'));
    }

    if (competition.isUefaChampions || compId === 'champions_europe_classic_so7' || compId.includes('ucl')) {
      return gameCompSlug.includes('champions-league') || gameCompSlug.includes('ucl');
    }

    if (competition.isUefaContender || compId === 'contender_europe_classic_so7' || compId.includes('uel')) {
      return gameCompSlug.includes('europa-league') || gameCompSlug.includes('conference-league');
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

  getClubStartingXiPool(clubCards, manualOverrides = {}) {
    const uniquePlayersMap = new Map();
    clubCards.forEach(c => {
      if (c.isInjuredOrSuspended) return;
      if (manualOverrides[c.playerSlug] === 'bench') return;
      if (c.activeMatch && c.activeMatch.alreadyPlayedScore === 0 && (c.activeMatch.alreadyPlayedMins === 0 || c.activeMatch.alreadyPlayedMins === null)) {
        return;
      }
      const prev = uniquePlayersMap.get(c.playerSlug);
      if (!prev || (c.isInSeason && !prev.isInSeason) || c.powerMultiplier > prev.powerMultiplier) {
        uniquePlayersMap.set(c.playerSlug, c);
      }
    });

    const uniquePlayers = Array.from(uniquePlayersMap.values());
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
    const isClubStackActive = Boolean(selectedClubSlug && selectedClubSlug !== 'ALL');

    const eligibleCards = allCards.filter(card => {
      if (!card) return false;
      if (card.scarcity !== targetScarcity) return false;
      if (card.isInjuredOrSuspended) return false;
      if (isClubStackActive && card.clubSlug !== selectedClubSlug) return false;
      return this.isCardEligibleForCompetition(card, competition, targetScarcity);
    });

    if (eligibleCards.length < slotsTemplate.length) return [];

    let evaluatedPool = eligibleCards.map(card =>
      this.evaluateCardForGw(card, selectedGw, strategy, competition, manualOverrides[card.playerSlug] || null)
    );

    if (isClubStackActive) {
      const clubXiSlugs = this.getClubStartingXiPool(evaluatedPool, manualOverrides);
      const filteredToXi = evaluatedPool.filter(c => clubXiSlugs.has(c.playerSlug));
      if (filteredToXi.length >= slotsTemplate.length) {
        evaluatedPool = filteredToXi;
      }
    }

    const activePlayableCards = evaluatedPool.filter(c => Boolean(c.activeMatch) && c.selectionPriority > 0 && manualOverrides[c.playerSlug] !== 'bench');
    const activeRoles = new Set(activePlayableCards.map(c => c.position));
    const canBuildFullActiveTeam =
      activePlayableCards.length >= slotsTemplate.length &&
      activeRoles.has('GK') &&
      activeRoles.has('DEF') &&
      activeRoles.has('MID') &&
      activeRoles.has('FWD');

    const isLeagueOnBreakMode = !canBuildFullActiveTeam;
    const workingPool = canBuildFullActiveTeam
      ? activePlayableCards
      : evaluatedPool.filter(c => {
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

      const captainPool = [...picked].sort((a, b) => {
        const aSc = a.projectedScore > 0 ? a.projectedScore : a.standbyScore;
        const bSc = b.projectedScore > 0 ? b.projectedScore : b.standbyScore;
        return bSc - aSc;
      });
      const captainId = captainPool[0]?.id;

      const finalStarters = picked.map(p => {
        const isCap = p.id === captainId;
        const baseScore = p.projectedScore > 0 ? p.projectedScore : p.standbyScore;
        const finalScore = isCap ? Number((baseScore * 1.25).toFixed(1)) : baseScore;

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
      if (traits.shotStopper) roleMetrics.push('🛡️ Alto volume parate AA');
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
      if (!card.isNationalCallupVerified || card.natFitnessTier === 'bench_nat') {
        statusLine = `🚫 Non titolare / Non convocato in Nazionale (${ns.starterCount || 0} da titolare in Naz.)`;
      } else if (card.natFitnessTier === 'starter') {
        statusLine = `✅ Titolare verificato in Nazionale (${ns.starterCount}/${ns.totalEntries} dal 1' in Naz. • ${ns.avgMins}' medi)`;
      } else {
        statusLine = `⚠️ In rotazione in Nazionale (${ns.playedCount}/${ns.totalEntries} presenze in Naz.)`;
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
      ? `🚀 Indice Ceiling (${lfIndex} pt): valorizza picco recente (${card.maxRecentScore} max) + bonus carta +${card.bonusPct}%.`
      : `🛡️ Indice Floor (${lfIndex} pt): valorizza continuità di minutaggio, base AA (${card.avgAas}) e bassa varianza.`;

    return `${statusLine}\n${matchContext}\n${optaBreakdown}\n${roleSpecificLine}\n${strategyNote}`;
  },

  evaluateCardForGw(card, selectedGw, strategy, competition, manualStatus = null) {
    const allGames = Array.isArray(card.scheduleGames) ? card.scheduleGames : [];
    const allowedGames = allGames.filter(g => this.isGameValidForCompetition(g, card, competition));

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

    let lfBaseProjection = 0;
    if (card.position === 'GK') {
      const gkForm = (baseL15 * 0.58) + (baseL5 * 0.42);
      const csBonus = (card.tacticalTraits?.cleanSheets || 0) * 1.4;
      const savesBonus = Math.min(4, (card.tacticalTraits?.saves || 0) * 0.25);
      lfBaseProjection = Math.min(72, Math.max(32, gkForm + csBonus + savesBonus));
    } else {
      const minutesFactor = card.avgMins >= 82
        ? 1.03
        : (card.avgMins >= 68 ? 1.00 : (card.avgMins >= 45 ? 0.88 : 0.72));

      if (isCeiling) {
        const peakRef = card.maxRecentScore > 0 ? Math.min(90, card.maxRecentScore) : baseL5;
        lfBaseProjection = ((baseL5 * 0.45) + (baseL15 * 0.35) + (peakRef * 0.20)) * minutesFactor;
      } else {
        const aaStabilityBonus = Math.min(8, (card.avgAas || 15) * 0.22);
        const volatilityPenalty = Math.min(5, (card.stdDev || 0) * 0.12);
        lfBaseProjection = ((baseL15 * 0.55) + (baseL5 * 0.45) + aaStabilityBonus - volatilityPenalty) * minutesFactor;
      }
      lfBaseProjection = Math.min(78, Math.max(22, lfBaseProjection));
    }

    const standbyScore = Number(Math.max(18, lfBaseProjection * (card.powerMultiplier || 1)).toFixed(1));

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

    const alreadyDnpInThisGw =
      activeMatch.alreadyPlayedScore !== null &&
      activeMatch.alreadyPlayedScore === 0 &&
      (activeMatch.alreadyPlayedMins === 0 || activeMatch.alreadyPlayedMins === null);

    const isUnverifiedOrBenchNat = isNationalMatch && (!card.isNationalCallupVerified || card.natFitnessTier === 'bench_nat') && manualStatus !== 'xi';

    if (alreadyDnpInThisGw || isUnverifiedOrBenchNat) {
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
          ? '0 pt (Panchina/DNP) nel match già disputato in questa GW'
          : 'Non convocato / Riserva in Nazionale',
        projectedScore: 0,
        standbyScore: 0,
        selectionPriority: 0,
        clubStandbyPriority: 0,
        matchupInsight: detailedInsight
      };
    }

    const homeAwayMultiplier = activeMatch.isHome === true ? 1.04 : 0.985;
    let adjustedProjection = lfBaseProjection * homeAwayMultiplier;

    if (isNationalMatch && card.natFitnessTier === 'rotation' && manualStatus !== 'xi') {
      adjustedProjection *= 0.84;
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
        selectionPriority: 0,
        clubStandbyPriority: 0,
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
        if (!isLeagueOnBreakMode) {
          const aHasGame = a.selectionPriority > 0 ? 1 : 0;
          const bHasGame = b.selectionPriority > 0 ? 1 : 0;
          if (bHasGame !== aHasGame) return bHasGame - aHasGame;
        }

        if (a.playerSlug === b.playerSlug && a.isInSeason !== b.isInSeason) {
          if (inSeasonTargetMet && requiredInSeason > 0) {
            return (a.isInSeason ? 1 : 0) - (b.isInSeason ? 1 : 0);
          }
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
        }

        if (!inSeasonTargetMet && requiredInSeason > 0 && a.isInSeason !== b.isInSeason) {
          return (b.isInSeason ? 1 : 0) - (a.isInSeason ? 1 : 0);
        }

        const aPrio = isLeagueOnBreakMode ? (a.clubStandbyPriority || 2) : a.selectionPriority;
        const bPrio = isLeagueOnBreakMode ? (b.clubStandbyPriority || 2) : b.selectionPriority;
        if (bPrio !== aPrio) return bPrio - aPrio;

        const aTeamKey = `${a.activeMatch?.teamName || a.clubSlug}_${a.position}`;
        const bTeamKey = `${b.activeMatch?.teamName || b.clubSlug}_${b.position}`;
        const aPenalty = (a.position === 'DEF' || a.position === 'GK') && selectedTeamPositionKeys.has(aTeamKey) ? 10 : 0;
        const bPenalty = (b.position === 'DEF' || b.position === 'GK') && selectedTeamPositionKeys.has(bTeamKey) ? 10 : 0;

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
