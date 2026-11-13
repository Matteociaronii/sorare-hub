// SorareHub - Exact League/Cup Filtering (===) + Bespoke Player Scouting Dossiers
const OptimizerEngine = {
  // Mappa rigorosa di normalizzazione degli slug dei campionati Sorare (impedisce qualsiasi confusione tra Bundesliga-DE, Bundesliga-AT e 2-Bundesliga-DE!)
  normalizeLeagueSlug(rawSlug) {
    const s = String(rawSlug || '').toLowerCase().trim();
    if (!s) return 'other';

    // 1. Esclusioni prioritarie per campionati di seconda fascia o omonimi
    if (s === '2-bundesliga' || s === '2-bundesliga-de' || s.startsWith('2-bundesliga')) return '2-bundesliga-de';
    if (s === 'bundesliga-at' || s === 'austrian-bundesliga' || s.includes('austria')) return 'bundesliga-at';
    if (s === 'ligue-2' || s === 'ligue-2-fr' || s.startsWith('ligue-2')) return 'ligue-2-fr';
    if (s === 'serie-b' || s === 'serie-b-it' || s.startsWith('serie-b')) return 'serie-b-it';
    if (s === 'serie-a-br' || s === 'brasileirao' || s.includes('brazil')) return 'serie-a-br';
    if (s === 'segunda-division' || s === 'segunda-division-es' || s === 'laliga-2' || s === 'laliga-hypermotion') return 'segunda-division-es';
    if (s === 'championship' || s === 'efl-championship' || s === 'championship-gb-eng') return 'championship-gb-eng';
    if (s === 'scottish-premiership' || s === 'premiership-gb-sct' || s === 'premiership') return 'premiership-gb-sct';

    // 2. Top 5 Campionati Europei (Slug Canonici Esatti)
    if (s === 'premier-league' || s === 'premier-league-gb-eng') return 'premier-league-gb-eng';
    if (s === 'serie-a' || s === 'serie-a-it') return 'serie-a-it';
    if (s === 'laliga' || s === 'la-liga' || s === 'laliga-es' || s === 'primera-division' || s === 'primera-division-es') return 'laliga-es';
    if (s === 'bundesliga' || s === 'bundesliga-de') return 'bundesliga-de';
    if (s === 'ligue-1' || s === 'ligue-1-fr') return 'ligue-1-fr';

    // 3. Altri Campionati Nazionali
    if (s === 'primeira-liga' || s === 'primeira-liga-pt' || s === 'liga-portugal') return 'primeira-liga-pt';
    if (s === 'eredivisie' || s === 'eredivisie-nl') return 'eredivisie-nl';
    if (s === 'jupiler-pro-league' || s === 'jupiler-pro-league-be' || s === 'first-division-a') return 'jupiler-pro-league-be';
    if (s === 'super-lig' || s === 'super-lig-tr' || s === 'turkish-super-lig') return 'super-lig-tr';
    if (s === 'superliga-dk' || s === 'danish-superliga' || s === 'superliga') return 'superliga-dk';
    if (s === 'super-league-ch' || s === 'swiss-super-league' || s === 'super-league') return 'super-league-ch';
    if (s === 'eliteserien' || s === 'eliteserien-no') return 'eliteserien-no';
    if (s === 'ekstraklasa' || s === 'ekstraklasa-pl') return 'ekstraklasa-pl';
    if (s === 'supersport-hnl' || s === 'prva-hnl' || s === '1-hnl-hr' || s === 'croatian-first-football-league') return '1-hnl-hr';
    if (s === 'mls' || s === 'mls-us' || s === 'major-league-soccer') return 'mls-us';
    if (s === 'j1-league' || s === 'j1-league-jp') return 'j1-league-jp';
    if (s === 'k-league-1' || s === 'k-league-1-kr') return 'k-league-1-kr';

    return s;
  },

  TOP_5_CANONICAL_LEAGUES: new Set([
    'premier-league-gb-eng',
    'serie-a-it',
    'laliga-es',
    'bundesliga-de',
    'ligue-1-fr'
  ]),

  // Club qualificati alla UEFA Champions League (SENZA Celtic e senza squadre di Europa/Conference League!)
  UCL_QUALIFIED_CLUBS: new Set([
    'real-madrid', 'real-madrid-cf',
    'barcelona', 'fc-barcelona',
    'atletico-madrid', 'club-atletico-de-madrid',
    'athletic-club', 'villarreal', 'villarreal-cf',
    'manchester-city', 'manchester-city-fc',
    'arsenal', 'arsenal-fc',
    'liverpool', 'liverpool-fc',
    'aston-villa', 'aston-villa-fc',
    'chelsea', 'chelsea-fc',
    'newcastle-united', 'newcastle',
    'tottenham-hotspur', 'tottenham',
    'manchester-united', 'manchester-united-fc',
    'inter', 'internazionale', 'fc-internazionale-milano',
    'milan', 'ac-milan',
    'juventus', 'juventus-fc',
    'atalanta', 'atalanta-bc',
    'napoli', 'ssc-napoli',
    'bologna', 'bologna-fc-1909',
    'bayern-munchen', 'fc-bayern-munchen',
    'bayer-04-leverkusen', 'bayer-leverkusen',
    'borussia-dortmund', 'dortmund',
    'rb-leipzig', 'rasenballsport-leipzig',
    'vfb-stuttgart', 'stuttgart',
    'eintracht-frankfurt',
    'paris-saint-germain', 'psg',
    'as-monaco', 'monaco',
    'losc-lille', 'lille',
    'olympique-de-marseille', 'marseille',
    'sl-benfica', 'benfica',
    'sporting-cp', 'sporting-clube-de-portugal',
    'fc-porto', 'porto',
    'psv', 'psv-eindhoven',
    'feyenoord', 'feyenoord-rotterdam',
    'afc-ajax', 'ajax',
    'club-brugge', 'club-brugge-kv',
    'sturm-graz', 'sk-sturm-graz',
    'fc-red-bull-salzburg', 'salzburg',
    'gnk-dinamo-zagreb', 'dinamo-zagreb',
    'shakhtar-donetsk', 'fc-shakhtar-donetsk',
    'ac-sparta-praha', 'sparta-praha',
    'sk-slavia-praha', 'slavia-praha',
    'bsc-young-boys', 'young-boys',
    'fk-crvena-zvezda', 'crvena-zvezda',
    'sk-slovan-bratislava', 'slovan-bratislava',
    'galatasaray', 'galatasaray-sk'
  ]),

  // Club qualificati a UEFA Europa League / UEFA Conference League (NESSUN club di Champions League come Inter o Man United!)
  UEL_UECL_QUALIFIED_CLUBS: new Set([
    'as-roma', 'roma',
    'ss-lazio', 'lazio',
    'acf-fiorentina', 'fiorentina',
    'real-sociedad', 'real-sociedad-de-futbol',
    'real-betis', 'real-betis-balompie',
    'olympique-lyonnais', 'lyon',
    'ogc-nice', 'nice',
    'rc-lens', 'lens',
    'rc-strasbourg-alsace', 'strasbourg',
    'tsg-1899-hoffenheim', 'hoffenheim',
    'sc-freiburg', 'freiburg',
    '1-fsv-mainz-05', 'mainz',
    'az-alkmaar', 'az',
    'fc-twente', 'twente',
    'fc-utrecht', 'utrecht',
    'sc-braga', 'braga',
    'vitoria-guimaraes', 'vitoria-sc',
    'rsc-anderlecht', 'anderlecht',
    'union-saint-gilloise', 'royale-union-saint-gilloise',
    'kaa-gent', 'gent',
    'krc-genk', 'genk',
    'rangers', 'rangers-fc',
    'celtic', 'celtic-fc',
    'heart-of-midlothian', 'hearts',
    'olympiacos-fc', 'olympiacos',
    'paok', 'paok-fc',
    'panathinaikos', 'panathinaikos-fc',
    'besiktas', 'besiktas-jk',
    'fenerbahce', 'fenerbahce-sk',
    'trabzonspor',
    'fc-midtjylland', 'midtjylland',
    'fc-kobenhavn', 'kobenhavn',
    'fk-bodo-glimt', 'bodo-glimt',
    'malmo-ff', 'malmo',
    'if-elfsborg', 'elfsborg',
    'sk-rapid', 'rapid-wien', 'sk-rapid-wien',
    'lask', 'lask-linz',
    'fc-lugano', 'lugano',
    'servette-fc', 'servette',
    'fc-basel-1893', 'basel',
    'legia-warszawa', 'legia',
    'jagiellonia-bialystok', 'jagiellonia'
  ]),

  // Verifica se il club del giocatore partecipa alla UEFA Champions League
  isClubInChampionsLeague(card) {
    const clubSlug = String(card.clubSlug || '').toLowerCase().trim();
    const clubComps = Array.isArray(card.activeClubCompetitions) ? card.activeClubCompetitions : [];

    // Se il club non è il Celtic e ha partite ufficiali di Champions League in calendario/storico, è in UCL
    if (clubSlug.includes('celtic')) return false;

    const hasUclInSchedule = clubComps.some(c => c === 'uefa-champions-league' || c === 'champions-league');
    if (hasUclInSchedule) return true;

    const hasUelOrUeclInSchedule = clubComps.some(c =>
      c === 'uefa-europa-league' || c === 'europa-league' ||
      c === 'uefa-europa-conference-league' || c === 'uefa-conference-league' || c === 'conference-league'
    );
    if (hasUelOrUeclInSchedule) return false;

    return this.UCL_QUALIFIED_CLUBS.has(clubSlug);
  },

  // Verifica se il club del giocatore partecipa a UEFA Europa League / Conference League
  isClubInContenderEurope(card) {
    const clubSlug = String(card.clubSlug || '').toLowerCase().trim();
    const clubComps = Array.isArray(card.activeClubCompetitions) ? card.activeClubCompetitions : [];

    // Regola ferrea: se il club fa la Champions League (es. Inter, Man United, Real Madrid, ecc.), NON PUÒ MAI entrare in Contender Europe!
    if (this.isClubInChampionsLeague(card)) return false;

    const hasUelOrUeclInSchedule = clubComps.some(c =>
      c === 'uefa-europa-league' || c === 'europa-league' ||
      c === 'uefa-europa-conference-league' || c === 'uefa-conference-league' || c === 'conference-league'
    );
    if (hasUelOrUeclInSchedule) return true;

    return this.UEL_UECL_QUALIFIED_CLUBS.has(clubSlug);
  },

  isCardEligibleForCompetition(card, competition, scarcity) {
    const compId = String(competition.id || '').toLowerCase();
    const canonicalCardLeague = this.normalizeLeagueSlug(card.leagueSlug);

    // 1) Under 23
    if (competition.u23Only || compId.includes('u23')) {
      return Boolean(card.isU23);
    }

    // 2) All-Star (Bacino Universale)
    if (compId.includes('all_star') || compId.includes('all-star')) {
      return true;
    }

    // 3) CHAMPIONS EUROPE — UEFA Champions League (SO7)
    if (competition.isUefaChampions || compId === 'champions_europe_classic_so7') {
      return this.isClubInChampionsLeague(card);
    }

    // 4) CONTENDER EUROPE — UEFA Europa & Conference League (SO7)
    if (competition.isUefaContender || compId === 'contender_europe_classic_so7') {
      return this.isClubInContenderEurope(card);
    }

    // 5) Champion Europe — Classic (Top 5 Campionati: Premier, Serie A, LaLiga, Bundesliga Tedesca, Ligue 1)
    // Qui Rapid Vienna (bundesliga-at) e 2. Bundesliga (2-bundesliga-de) vengono bloccati al 100%!
    if (compId === 'champion_europe_classic_so7' || compId === 'champion_europe') {
      return this.TOP_5_CANONICAL_LEAGUES.has(canonicalCardLeague);
    }

    // 6) Qualsiasi altro torneo (Singoli campionati nazionali, Contender, Challenger): confronto ESATTO (===) sugli slug normalizzati!
    if (Array.isArray(competition.leagues) && !competition.leagues.includes('ALL')) {
      const allowedCanonicalSet = new Set(
        competition.leagues.map(l => this.normalizeLeagueSlug(l))
      );
      return allowedCanonicalSet.has(canonicalCardLeague);
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

    if (competition.isUefaChampions || compId === 'champions_europe_classic_so7') {
      return gameCompSlug.includes('champions-league') || gameCompSlug.includes('ucl');
    }

    if (competition.isUefaContender || compId === 'contender_europe_classic_so7') {
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
        const capBonusPts = isCap ? Number((finalScore - baseScore).toFixed(1)) : 0;

        // Genera il Dossier Analitico Individuale completo (includendo il ruolo esatto nella formazione e se è Capitano)
        const bespokeDossier = this.buildBespokeScoutingDossier(
          p,
          p.activeMatch,
          String(strategy || '').toLowerCase() === 'ceiling',
          manualOverrides[p.playerSlug] || null,
          finalScore,
          Boolean(p.activeMatch && p.activeMatch.isNationalTeam),
          {
            isCaptain: isCap,
            capBonusPts: capBonusPts,
            slotRole: p.slotRole,
            rank: rank,
            requiredInSeason: requiredInSeason
          }
        );

        return {
          ...p,
          isCaptain: isCap,
          isClubOnBreak: !p.activeMatch,
          projectedScore: finalScore,
          matchupInsight: bespokeDossier
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

  // Dossier Analitico Individuale: costruisce un commento tecnico unico per ogni giocatore basato sui suoi match reali, trend L5-L15, rapporto AA/Decisive e ruolo nella formazione
  buildBespokeScoutingDossier(card, activeMatch, isCeiling, manualStatus, finalProjScore, isNationalMatch, lineupContext = null) {
    const stats = isNationalMatch && card.natStats?.playedCount > 0 ? card.natStats : (card.clubStats || {});
    const logs = Array.isArray(stats.matchLogs) ? stats.matchLogs : [];

    // 1. SEZIONE TITOLARITÀ & STRISCIA MINUTAGGIO REALE
    const minsHistoryStr = logs.length > 0
      ? logs.slice(0, 4).map(m => `${m.mins}'`).join(' → ')
      : `${card.avgMins || 0}' medi`;

    let statusSection = '';
    if (manualStatus === 'bench') {
      statusSection = `🪑 STATO: Escluso manualmente (Panchina).`;
    } else if (manualStatus === 'xi') {
      statusSection = `✅ STATO: Confermato nell'11 Titolare (${minsHistoryStr}).`;
    } else if (isNationalMatch) {
      const ns = card.natStats || {};
      if (card.natFitnessTier === 'starter') {
        statusSection = `🌍 NAZIONALE: Titolare fisso (${ns.starterCount}/${ns.totalEntries} dal 1' • Minutaggio: ${minsHistoryStr}).`;
      } else {
        statusSection = `🌍 NAZIONALE: Impiego in rotazione (${ns.playedCount}/${ns.totalEntries} presenze • Minutaggio: ${minsHistoryStr}).`;
      }
    } else if (card.baseFitnessTier === 'starter') {
      const starterPct = stats.totalEntries > 0 ? Math.round((stats.starterCount / stats.totalEntries) * 100) : 100;
      statusSection = `✅ TITOLARITÀ (${starterPct}% dal 1'): Perno di ${card.club} (${stats.starterCount}/${stats.totalEntries || 5} da titolare • Minuti: ${minsHistoryStr}).`;
    } else {
      statusSection = `⚠️ ROTAZIONE: Gestione minutaggio in ${card.club} (${stats.playedCount}/${stats.totalEntries || 5} presenze • Minuti: ${minsHistoryStr}).`;
    }

    // 2. CRONOLOGIA REALE DEGLI ULTIMI MATCH (Avversario, Voto, Minuti e Bonus)
    let recentLogSection = '';
    if (logs.length > 0) {
      const formattedLogs = logs.slice(0, 3).map(m => {
        const bonusTags = [];
        if (m.goals > 0) bonusTags.push(`${m.goals}G`);
        if (m.assists > 0) bonusTags.push(`${m.assists}A`);
        if (card.position === 'GK' && m.cleanSheet > 0) bonusTags.push('CS');
        if (card.position === 'GK' && m.saves >= 4) bonusTags.push(`${m.saves} par.`);
        const bonusStr = bonusTags.length > 0 ? `, ${bonusTags.join('+')}` : '';
        return `vs ${m.opponent}: ${m.score} pt (${m.mins}'${bonusStr})`;
      }).join(' • ');
      recentLogSection = `🗓️ ULTIME GARE: ${formattedLogs}.`;
    } else {
      recentLogSection = `🗓️ STORICO: Media L15 ${card.l15} pt • L5 ${card.l5} pt.`;
    }

    // 3. DNA TATTICO, COMPOSIZIONE DEL VOTO (AA vs DECISIVE) & TREND DI FORMA (L5 vs L15)
    const totalAvg = (card.avgAas + card.avgDecisive) > 0 ? (card.avgAas + card.avgDecisive) : (card.l5 || 45);
    const aaSharePct = Math.min(100, Math.round((card.avgAas / totalAvg) * 100));
    const formDelta = Number((card.l5 - card.l15).toFixed(1));
    const formTrendStr = formDelta >= 4.5
      ? `in forte crescita (+${formDelta} pt sulla L15 di ${card.l15})`
      : (formDelta <= -4.5
        ? `in flessione (${formDelta} pt rispetto alla L15 di ${card.l15})`
        : `estremamente regolare (L5 ${card.l5} vs L15 ${card.l15})`);

    let tacticalDnaSection = '';
    if (card.position === 'GK') {
      tacticalDnaSection = `🧤 PROFILO PORTIERE: Rendimento ${formTrendStr}. Nelle ultime ${stats.playedCount || 5} gare ha registrato ${stats.cleanSheets || 0} Clean Sheet e ${stats.saves || 0} parate complessive (base AA ${card.avgAas} pt, picco a ${card.maxRecentScore} pt).`;
    } else if (aaSharePct >= 58 && card.avgAas >= 20) {
      tacticalDnaSection = `🧬 DNA TATTICO (Pavimento Solido - ${aaSharePct}% AA): Giocatore ${formTrendStr}. Genera ${card.avgAas} pt medi di pura attività di gioco (passaggi chiave, possessi vinti e duelli), garantendo voti alti anche senza bisogno di gol o assist.`;
    } else if (card.avgDecisive >= 22 || (stats.goals + stats.assists) >= 2) {
      tacticalDnaSection = `⚡ DNA TATTICO (Finalizzatore da Bonus): Forma ${formTrendStr}. Ha prodotto ${stats.goals || 0} gol e ${stats.assists || 0} assist nelle ultime ${stats.playedCount || 5} uscite (${card.avgDecisive} pt Decisive medi + ${card.avgAas} pt AA, picco di ${card.maxRecentScore} pt).`;
    } else {
      tacticalDnaSection = `📊 DNA TATTICO (Equilibrato): Rendimento ${formTrendStr} con ${card.avgAas} pt di base All-Around e ${card.avgDecisive} pt da giocate decisive (oscillazione voti [${card.minRecentScore}–${card.maxRecentScore}], σ=${card.stdDev}).`;
    }

    // 4. LETTURA SPECIFICA DEL MATCHUP IN QUESTA GW
    let matchupSection = '';
    if (!activeMatch) {
      matchupSection = `⏸️ CALENDARIO GW: Nessuna gara in programma per ${card.club} in questa finestra (valutazione di riserva: ${finalProjScore} pt).`;
    } else {
      const venueStr = activeMatch.isHome ? 'in casa (+4% fattore campo)' : 'in trasferta';
      const playedNote = activeMatch.alreadyPlayedScore !== null ? ` [Gara già disputata: ${activeMatch.alreadyPlayedScore} pt]` : '';
      matchupSection = `🏟️ MATCHUP GW: Impegno ${venueStr} contro ${activeMatch.opponentName} (${activeMatch.competitionName})${playedNote}.`;
    }

    // 5. RUOLO STRATEGICO NELLA FORMAZIONE E SCELTA SLOT
    let roleInTeamSection = '';
    if (lineupContext) {
      const cardTypeTag = card.isInSeason ? `Carta In-Season 26/27 (+${card.bonusPct}% bonus)` : `Slot Classic (+${card.bonusPct}% bonus)`;
      if (lineupContext.isCaptain) {
        roleInTeamSection = `👑 RUOLO IN SQUADRA #${lineupContext.rank}: Scelto come CAPITANO (+${lineupContext.capBonusPts} pt extra) per massimizzare la proiezione di ${finalProjScore} pt (${cardTypeTag}).`;
      } else if (lineupContext.slotRole === 'EXTRA') {
        roleInTeamSection = `🎯 RUOLO IN SQUADRA #${lineupContext.rank}: Schierato nello slot EXTRA (${cardTypeTag}) con proiezione ${finalProjScore} pt in assetto ${isCeiling ? 'Ceiling (ricerca del picco)' : 'Floor (massima affidabilità)'}.`;
      } else {
        roleInTeamSection = `🎯 RUOLO IN SQUADRA #${lineupContext.rank}: Titolare slot ${lineupContext.slotRole} (${cardTypeTag}) • Proiezione attesa: ${finalProjScore} pt.`;
      }
    }

    return [statusSection, recentLogSection, tacticalDnaSection, matchupSection, roleInTeamSection]
      .filter(Boolean)
      .join('\n');
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

    let baseProjection = 0;
    if (card.position === 'GK') {
      const gkForm = (baseL15 * 0.58) + (baseL5 * 0.42);
      const csBonus = (card.tacticalTraits?.cleanSheets || 0) * 1.4;
      const savesBonus = Math.min(4, (card.tacticalTraits?.saves || 0) * 0.25);
      baseProjection = Math.min(72, Math.max(32, gkForm + csBonus + savesBonus));
    } else {
      const minutesFactor = card.avgMins >= 82
        ? 1.03
        : (card.avgMins >= 68 ? 1.00 : (card.avgMins >= 45 ? 0.88 : 0.72));

      if (isCeiling) {
        const peakRef = card.maxRecentScore > 0 ? Math.min(90, card.maxRecentScore) : baseL5;
        baseProjection = ((baseL5 * 0.45) + (baseL15 * 0.35) + (peakRef * 0.20)) * minutesFactor;
      } else {
        const aaStabilityBonus = Math.min(8, (card.avgAas || 15) * 0.22);
        const volatilityPenalty = Math.min(5, (card.stdDev || 0) * 0.12);
        baseProjection = ((baseL15 * 0.55) + (baseL5 * 0.45) + aaStabilityBonus - volatilityPenalty) * minutesFactor;
      }
      baseProjection = Math.min(78, Math.max(22, baseProjection));
    }

    const standbyScore = Number(Math.max(18, baseProjection * (card.powerMultiplier || 1)).toFixed(1));

    if (!activeMatch || card.isInjuredOrSuspended) {
      const detailedInsight = this.buildBespokeScoutingDossier(card, null, isCeiling, manualStatus, standbyScore, false, null);
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
      const detailedInsight = this.buildBespokeScoutingDossier(card, activeMatch, isCeiling, manualStatus, 0, isNationalMatch, null);
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
    let adjustedProjection = baseProjection * homeAwayMultiplier;

    if (isNationalMatch && card.natFitnessTier === 'rotation' && manualStatus !== 'xi') {
      adjustedProjection *= 0.84;
    }

    if (manualStatus === 'bench') {
      const benchScore = Number(Math.max(12, adjustedProjection * 0.45 * (card.powerMultiplier || 1)).toFixed(1));
      const detailedInsight = this.buildBespokeScoutingDossier(card, activeMatch, isCeiling, 'bench', benchScore, isNationalMatch, null);
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
    const detailedInsight = this.buildBespokeScoutingDossier(card, activeMatch, isCeiling, manualStatus, projectedScore, isNationalMatch, null);

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
