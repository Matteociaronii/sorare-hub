// SorareHub - Double Match (2 Games in GW) + Dynamic Opponent Form Analysis + Role-Specific Dossiers
const OptimizerEngine = {
  normalizeLeagueSlug(rawSlug) {
    const s = String(rawSlug || '').toLowerCase().trim();
    if (!s) return 'other';

    if (s === '2-bundesliga' || s === '2-bundesliga-de' || s.startsWith('2-bundesliga')) return '2-bundesliga-de';
    if (s === 'bundesliga-at' || s === 'austrian-bundesliga' || s.includes('austria')) return 'bundesliga-at';
    if (s === 'ligue-2' || s === 'ligue-2-fr' || s.startsWith('ligue-2')) return 'ligue-2-fr';
    if (s === 'serie-b' || s === 'serie-b-it' || s.startsWith('serie-b')) return 'serie-b-it';
    if (s === 'serie-a-br' || s === 'brasileirao' || s.includes('brazil')) return 'serie-a-br';
    if (s === 'segunda-division' || s === 'segunda-division-es' || s === 'laliga-2' || s === 'laliga-hypermotion') return 'segunda-division-es';
    if (s === 'championship' || s === 'efl-championship' || s === 'championship-gb-eng') return 'championship-gb-eng';
    if (s === 'scottish-premiership' || s === 'premiership-gb-sct' || s === 'premiership') return 'premiership-gb-sct';

    if (s === 'premier-league' || s === 'premier-league-gb-eng') return 'premier-league-gb-eng';
    if (s === 'serie-a' || s === 'serie-a-it') return 'serie-a-it';
    if (s === 'laliga' || s === 'la-liga' || s === 'laliga-es' || s === 'primera-division' || s === 'primera-division-es') return 'laliga-es';
    if (s === 'bundesliga' || s === 'bundesliga-de') return 'bundesliga-de';
    if (s === 'ligue-1' || s === 'ligue-1-fr') return 'ligue-1-fr';

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

  isClubInChampionsLeague(card) {
    const clubSlug = String(card.clubSlug || '').toLowerCase().trim();
    const clubComps = Array.isArray(card.activeClubCompetitions) ? card.activeClubCompetitions : [];

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

  isClubInContenderEurope(card) {
    const clubSlug = String(card.clubSlug || '').toLowerCase().trim();
    const clubComps = Array.isArray(card.activeClubCompetitions) ? card.activeClubCompetitions : [];

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

    if (competition.u23Only || compId.includes('u23')) {
      return Boolean(card.isU23);
    }

    if (compId.includes('all_star') || compId.includes('all-star')) {
      return true;
    }

    if (competition.isUefaChampions || compId === 'champions_europe_classic_so7') {
      return this.isClubInChampionsLeague(card);
    }

    if (competition.isUefaContender || compId === 'contender_europe_classic_so7') {
      return this.isClubInContenderEurope(card);
    }

    if (compId === 'champion_europe_classic_so7' || compId === 'champion_europe') {
      return this.TOP_5_CANONICAL_LEAGUES.has(canonicalCardLeague);
    }

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

  // Valuta dinamicamente la difficoltà e il momento di forma di una singola avversaria per il ruolo specifico del giocatore
  analyzeSingleMatchupDifficulty(game, cardPosition) {
    if (!game) {
      return { multiplier: 1.0, difficultyScore: 0.5, summaryText: '' };
    }

    const venueFactor = game.isHome ? 1.035 : 0.985;
    const venueLabel = game.isHome ? 'in casa' : 'in trasferta';
    const oppForm = game.opponentForm;

    // Se abbiamo i dati dinamici reali delle ultime partite dell'avversaria (gol fatti, gol subiti, W-D-L):
    if (oppForm && oppForm.sampleSize >= 1 && oppForm.avgGa !== null) {
      const { avgGf, avgGa, recordStr, strengthIndex, sampleSize } = oppForm;
      let roleMod = 1.0;
      let tacticalNote = '';

      if (cardPosition === 'GK' || cardPosition === 'DEF') {
        if (avgGf >= 1.9) {
          roleMod = 0.96; // Avversaria con attacco molto prolifico -> più difficile il Clean Sheet
          tacticalNote = `avversaria in striscia offensiva (${avgGf} gol segnati/gara nelle ultime ${sampleSize}, ${recordStr}): match impegnativo per la porta inviolata`;
        } else if (avgGf <= 0.95) {
          roleMod = 1.045; // Avversaria che segna poco -> ottimo per Clean Sheet
          tacticalNote = `avversaria con attacco sterile (${avgGf} gol segnati/gara nelle ultime ${sampleSize}, ${recordStr}): alta probabilità di Clean Sheet`;
        } else {
          roleMod = 1.0 + ((0.55 - strengthIndex) * 0.06);
          tacticalNote = `avversaria in equilibrio (${recordStr}, media ${avgGf} GF / ${avgGa} GS nelle ultime ${sampleSize})`;
        }
      } else {
        // MID e FWD: guardiamo soprattutto quanto concede la difesa avversaria (avgGa)
        if (avgGa >= 1.75) {
          roleMod = 1.055; // Difesa avversaria vulnerabile -> boost per gol/assist
          tacticalNote = `avversaria in difficoltà difensiva (concede ${avgGa} gol/gara nelle ultime ${sampleSize}, ${recordStr}): scenario ideale per bonus offensivi`;
        } else if (avgGa <= 0.85 && strengthIndex >= 0.62) {
          roleMod = 0.965; // Difesa avversaria blindata -> più difficile trovare il bonus
          tacticalNote = `avversaria solida dietro (solo ${avgGa} gol subiti/gara nelle ultime ${sampleSize}, ${recordStr}): gara chiusa, conta la base AA`;
        } else {
          roleMod = 1.0 + ((0.55 - strengthIndex) * 0.06);
          tacticalNote = `avversaria con stato di forma ${recordStr} (${avgGa} gol concessi/gara nelle ultime ${sampleSize})`;
        }
      }

      const finalMult = Number((venueFactor * roleMod).toFixed(3));
      return {
        multiplier: finalMult,
        difficultyScore: strengthIndex,
        summaryText: `${venueLabel} vs ${game.opponentName} [${tacticalNote}]`
      };
    }

    // Se l'avversaria non ha ancora uno storico di gol nel campione ma ha un indice di forza basato sui punteggi SO5:
    if (oppForm && typeof oppForm.strengthIndex === 'number') {
      const sIdx = oppForm.strengthIndex;
      const roleMod = 1.0 + ((0.55 - sIdx) * 0.07);
      const finalMult = Number((venueFactor * roleMod).toFixed(3));
      const levelDesc = sIdx >= 0.65 ? 'avversaria in ottimo momento di forma' : (sIdx <= 0.42 ? 'avversaria in flessione recente' : 'impegno equilibrato');
      return {
        multiplier: finalMult,
        difficultyScore: sIdx,
        summaryText: `${venueLabel} vs ${game.opponentName} (${levelDesc})`
      };
    }

    return {
      multiplier: venueFactor,
      difficultyScore: game.isHome ? 0.46 : 0.54,
      summaryText: `${venueLabel} vs ${game.opponentName} (${game.competitionName})`
    };
  },

  // Valuta un intero pacchetto di partite nella GW (gestendo sia il Match Singolo sia il DOPPIO MATCH con boost calibrato!)
  evaluateGwMatchesPackage(gwMatches, cardPosition) {
    if (!Array.isArray(gwMatches) || gwMatches.length === 0) {
      return {
        combinedMultiplier: 1.0,
        doubleMatchBoostPct: 0,
        matchupNarrative: ''
      };
    }

    if (gwMatches.length === 1) {
      const single = this.analyzeSingleMatchupDifficulty(gwMatches[0], cardPosition);
      const playedNote = gwMatches[0].alreadyPlayedScore !== null
        ? ` • Voto reale già acquisito: ${gwMatches[0].alreadyPlayedScore} pt`
        : '';
      return {
        combinedMultiplier: single.multiplier,
        doubleMatchBoostPct: 0,
        matchupNarrative: `🏟️ MATCHUP GW: Sfida ${single.summaryText}${playedNote}.`
      };
    }

    // Caso DOPPIO MATCH (2 gare nella stessa Gameweek!)
    const m1 = this.analyzeSingleMatchupDifficulty(gwMatches[0], cardPosition);
    const m2 = this.analyzeSingleMatchupDifficulty(gwMatches[1], cardPosition);

    // Su Sorare conta il MIGLIOR punteggio tra le 2 partite:
    // Partiamo dal moltiplicatore della partita più favorevole tra le due, e aggiungiamo un boost per la seconda chance
    // strettamente calibrato sulla difficoltà della seconda partita!
    const bestSingleMult = Math.max(m1.multiplier, m2.multiplier);
    const avgDifficulty = (m1.difficultyScore + m2.difficultyScore) / 2;

    // Se entrambe le partite sono toste (avgDifficulty >= 0.62), il boost per la doppia gara è prudente (+4.5%)
    // Se almeno una partita è morbida/favorevole, il boost sale fino a +10.5%
    let secondChanceBoost = 0.075;
    if (avgDifficulty >= 0.62) {
      secondChanceBoost = 0.045;
    } else if (avgDifficulty <= 0.45) {
      secondChanceBoost = 0.105;
    }

    const combinedMult = Number((bestSingleMult * (1 + secondChanceBoost)).toFixed(3));
    const boostPct = Math.round(secondChanceBoost * 100);

    const difficultyComment = avgDifficulty >= 0.62
      ? `Doppio impegno probante: applicato boost prudente (+${boostPct}%) per la doppia chance di voto`
      : `Calendario favorevole con doppia occasione da bonus (+${boostPct}% boost sulla proiezione migliore)`;

    return {
      combinedMultiplier: combinedMult,
      doubleMatchBoostPct: boostPct,
      matchupNarrative: `🔥 DOPPIO MATCH IN GW (2 Gare): 1️⃣ ${m1.summaryText} • 2️⃣ ${m2.summaryText}. ${difficultyComment}.`
    };
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

        const bespokeDossier = this.buildBespokeScoutingDossier(
          p,
          p.gwMatches || (p.activeMatch ? [p.activeMatch] : []),
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

  buildBespokeScoutingDossier(card, gwMatches, isCeiling, manualStatus, finalProjScore, isNationalMatch, lineupContext = null) {
    const fullStats = card.combinedStats || card.clubStats || {};
    const logs = Array.isArray(fullStats.matchLogs) ? fullStats.matchLogs : [];
    const traits = card.tacticalTraits || {};
    const matchesList = Array.isArray(gwMatches) ? gwMatches : [];

    // 1. CONTINUITÀ & STRISCIA MINUTAGGIO REALE
    const minsHistoryStr = logs.length > 0
      ? logs.slice(0, 5).map(m => `${m.mins}'`).join(' → ')
      : `${card.avgMins || 0}' medi`;

    let statusSection = '';
    if (manualStatus === 'bench') {
      statusSection = `🪑 STATO: Escluso manualmente (Panchina).`;
    } else if (manualStatus === 'xi') {
      statusSection = `✅ STATO: Confermato nell'11 Titolare (Minutaggio recente: ${minsHistoryStr}).`;
    } else if (isNationalMatch) {
      const ns = card.natStats || {};
      if (ns.playedCount > 0) {
        statusSection = `🌍 IMPIEGO NAZIONALE & CLUB: ${ns.starterCount}/${ns.totalEntries} da titolare in Nazionale e ${card.clubStats?.starterCount || 0}/${card.clubStats?.totalEntries || 5} nel ${card.club} (Ultimi minutaggi: ${minsHistoryStr}).`;
      } else {
        statusSection = `🌍 NAZIONALE (Da verificare): Match in calendario ufficiale Sorare (${card.clubStats?.starterCount || 0}/${card.clubStats?.totalEntries || 5} da titolare nel ${card.club} • Minutaggi club: ${minsHistoryStr}).`;
      }
    } else if (card.baseFitnessTier === 'starter') {
      statusSection = `✅ CONTINUITÀ DAL 1': Titolare fisso nel ${card.club} (${fullStats.starterCount}/${fullStats.totalEntries || 5} gare dal 1' • Minutaggi: ${minsHistoryStr}).`;
    } else {
      statusSection = `⚠️ GESTIONE MINUTAGGIO: Impiegato in rotazione nel ${card.club} (${fullStats.playedCount}/${fullStats.totalEntries || 5} presenze • Minutaggi: ${minsHistoryStr}).`;
    }

    // 2. STORICO REALE DELLE ULTIME 4 PARTITE
    let recentLogSection = '';
    if (logs.length > 0) {
      const formattedLogs = logs.slice(0, 4).map(m => {
        const details = [`${m.mins}'`];
        if (m.goals > 0) details.push(`${m.goals}G`);
        if (m.assists > 0) details.push(`${m.assists}A`);
        if (card.position === 'GK' && m.cleanSheet > 0) details.push('CS');
        if (card.position === 'GK' && m.saves >= 3) details.push(`${m.saves} par.`);
        if (card.position === 'DEF' && m.defActions >= 5 && m.goals === 0) details.push(`${m.defActions} int/spaz`);
        if (card.position === 'MID' && m.passes >= 45 && m.goals === 0 && m.assists === 0) details.push(`${m.passes} pass.`);
        return `vs ${m.opponent}: ${m.score} pt (${details.join(', ')})`;
      }).join(' • ');
      recentLogSection = `🗓️ ULTIME ${Math.min(4, logs.length)} GARE: ${formattedLogs}.`;
    } else {
      recentLogSection = `🗓️ MEDIE STORICHE: L15 ${card.l15} pt • L5 ${card.l5} pt.`;
    }

    // 3. ARCHETIPO TATTICO SPECIFICO PER RUOLO
    const formDelta = Number((card.l5 - card.l15).toFixed(1));
    const formTrendStr = formDelta >= 4.0
      ? `in salita (+${formDelta} pt sulla L15 di ${card.l15})`
      : (formDelta <= -4.0
        ? `sotto la sua media abituale (${formDelta} pt rispetto alla L15 di ${card.l15})`
        : `in linea con il suo standard (L5 ${card.l5} vs L15 ${card.l15})`);

    let tacticalDnaSection = '';
    if (card.position === 'GK') {
      if ((traits.saves || 0) >= 12 || card.avgAas >= 10) {
        tacticalDnaSection = `🧤 ARCHETIPO (Portiere Para-Tiri ad Alto AA): Forma ${formTrendStr}. Nelle ultime ${fullStats.playedCount} gare ha sommato ${traits.saves || 0} parate e ${traits.cleanSheets || 0} Clean Sheet, aggiungendo +${card.avgAas} pt medi di All-Around oltre al voto base.`;
      } else {
        tacticalDnaSection = `🧤 ARCHETIPO (Portiere da Clean Sheet): Rendimento ${formTrendStr}. Garantisce sicurezza tra i pali con ${traits.cleanSheets || 0} porte inviolate nelle ultime ${fullStats.playedCount} gare (${traits.saves || 0} parate totali, picco di ${card.maxRecentScore} pt).`;
      }
    } else if (card.position === 'DEF') {
      if ((traits.goals + traits.assists) >= 2) {
        tacticalDnaSection = `⚡ ARCHETIPO DIFENSIVO (Terzino di Spinta / Pericolo da Palla Inattiva): Forma ${formTrendStr}. Oltre alla fase difensiva (${traits.avgDefActions || 0} interventi/gara), ha inciso davanti con ${traits.goals} gol e ${traits.assists} assist nelle ultime ${fullStats.playedCount} gare (+${card.avgAas} pt AA medi).`;
      } else if ((traits.avgPasses || 0) >= 48 && card.avgAas >= 16) {
        tacticalDnaSection = `🎯 ARCHETIPO DIFENSIVO (Regista Difensivo / Costruttore dal Basso): Rendimento ${formTrendStr}. Viaggia a ${traits.avgPasses} passaggi riusciti e ${traits.avgDuelsWon || 0} duelli vinti a partita, generando +${card.avgAas} pt di puro All-Around sopra i 35 pt base.`;
      } else if ((traits.avgDefActions || 0) >= 4.5 || (traits.avgDuelsWon || 0) >= 4.5 || card.avgAas >= 14) {
        tacticalDnaSection = `🛡️ ARCHETIPO DIFENSIVO (Stopper & Volume Interventi): Forma ${formTrendStr}. Produce una media di ${traits.avgDefActions || 0} tra intercetti, contrasti e respinte e ${traits.avgDuelsWon || 0} duelli vinti a gara (+${card.avgAas} pt AA medi, picco di ${card.maxRecentScore} pt).`;
      } else {
        tacticalDnaSection = `🧱 ARCHETIPO DIFENSIVO (Difensore Posizionale da Clean Sheet): Forma ${formTrendStr}. Basa il suo punteggio sulla tenuta di reparto (${traits.cleanSheets || 0} gare senza subire reti nelle ultime ${fullStats.playedCount}, media +${card.avgAas} pt AA e range [${card.minRecentScore}–${card.maxRecentScore}]).`;
      }
    } else if (card.position === 'MID') {
      if ((traits.goals + traits.assists) >= 2 && card.avgAas >= 18) {
        tacticalDnaSection = `👑 ARCHETIPO CENTROCAMPISTA (Tuttocampista Totale AA + Bonus): Forma ${formTrendStr}. Unisce un volume di gioco dominante (+${card.avgAas} pt AA medi, ${traits.avgPasses || 0} passaggi/gara) a ${traits.goals} gol e ${traits.assists} assist nelle ultime ${fullStats.playedCount} gare (picco ${card.maxRecentScore} pt).`;
      } else if ((traits.avgPasses || 0) >= 42 || card.avgAas >= 18) {
        tacticalDnaSection = `🧭 ARCHETIPO CENTROCAMPISTA (Metronomo da Pavimento Sicuro): Forma ${formTrendStr}. Macina ${traits.avgPasses || 0} passaggi precisi e ${traits.avgDuelsWon || 0} duelli vinti a partita, assicurando +${card.avgAas} pt medi di All-Around puro anche senza bonus gol.`;
      } else if ((traits.goals + traits.assists) >= 1) {
        tacticalDnaSection = `⚡ ARCHETIPO CENTROCAMPISTA (Incursore Offensivo): Forma ${formTrendStr}. Cerca costantemente l'inserimento (${traits.goals}G e ${traits.assists}A nelle ultime ${fullStats.playedCount} uscite, con +${card.avgAas} pt AA e ${traits.avgShotsOnTarget || 0} tiri nello specchio/gara).`;
      } else {
        tacticalDnaSection = `⚙️ ARCHETIPO CENTROCAMPISTA (Mediano di Equilibrio): Rendimento ${formTrendStr} (${traits.avgDefActions || 0} recuperi difensivi e ${traits.avgPasses || 0} passaggi di media, +${card.avgAas} pt AA, oscillazione [${card.minRecentScore}–${card.maxRecentScore}]).`;
      }
    } else {
      if (card.avgAas >= 16 && (traits.goals + traits.assists) >= 1) {
        tacticalDnaSection = `🔥 ARCHETIPO OFFENSIVO (Ala Creativa / Attaccante Completo): Forma ${formTrendStr}. Non dipende solo dal gol: abbina ${traits.goals} reti e ${traits.assists} assist a ben +${card.avgAas} pt medi di All-Around tra dribbling, passaggi chiave e tiri (picco ${card.maxRecentScore} pt).`;
      } else if ((traits.goals + traits.assists) >= 2 || card.avgDecisive >= 12) {
        tacticalDnaSection = `🎯 ARCHETIPO OFFENSIVO (Finalizzatore d'Area): Forma ${formTrendStr}. Incisivo sotto porta con ${traits.goals} gol e ${traits.assists} assist nelle ultime ${fullStats.playedCount} gare (+${card.avgDecisive} pt netti da bonus decisivi oltre il voto base).`;
      } else if (card.avgAas >= 12) {
        tacticalDnaSection = `⚡ ARCHETIPO OFFENSIVO (Attaccante di Manovra): Forma ${formTrendStr}. Partecipa attivamente allo sviluppo offensivo generando +${card.avgAas} pt AA medi (${traits.avgDuelsWon || 0} duelli vinti/gara, range [${card.minRecentScore}–${card.maxRecentScore}]).`;
      } else {
        tacticalDnaSection = `🏹 ARCHETIPO OFFENSIVO (Punta Centrale da Episodio): Rendimento ${formTrendStr} (base AA +${card.avgAas} pt, L15 ${card.l15} pt): profilo scelto per cercare il bonus pesante in area avversaria.`;
      }
    }

    // 4. ANALISI DINAMICA DELLE AVVERSARIE & EVENTUALE DOPPIO MATCH IN GW
    let matchupSection = '';
    if (matchesList.length === 0) {
      matchupSection = `⏸️ CALENDARIO GW: ${card.club} in sosta in questo turno (valutazione di riferimento: ${finalProjScore} pt).`;
    } else {
      const pkg = this.evaluateGwMatchesPackage(matchesList, card.position);
      matchupSection = pkg.matchupNarrative;
    }

    // 5. RUOLO NELLA FORMAZIONE
    let roleInTeamSection = '';
    if (lineupContext) {
      const cardTypeTag = card.isInSeason ? `In-Season 26/27 (+${card.bonusPct}%)` : `Classic (+${card.bonusPct}%)`;
      if (lineupContext.isCaptain) {
        roleInTeamSection = `👑 SCELTA CAPITANO (Squadra #${lineupContext.rank}): Fascia assegnata per incassare +${lineupContext.capBonusPts} pt extra e spingere la proiezione a ${finalProjScore} pt (${cardTypeTag}).`;
      } else if (lineupContext.slotRole === 'EXTRA') {
        roleInTeamSection = `🎯 SLOT EXTRA (Squadra #${lineupContext.rank}): Inserito come uomo in più (${cardTypeTag}) per il suo indice ${isCeiling ? 'Ceiling' : 'Floor'} da ${finalProjScore} pt.`;
      } else {
        roleInTeamSection = `🎯 TITOLARE ${lineupContext.slotRole} (Squadra #${lineupContext.rank}): Copre il reparto con ${finalProjScore} pt attesi (${cardTypeTag}).`;
      }
    }

    return [statusSection, recentLogSection, tacticalDnaSection, matchupSection, roleInTeamSection]
      .filter(Boolean)
      .join('\n');
  },

  evaluateCardForGw(card, selectedGw, strategy, competition, manualStatus = null) {
    const allGames = Array.isArray(card.scheduleGames) ? card.scheduleGames : [];
    const allowedGames = allGames.filter(g => this.isGameValidForCompetition(g, card, competition));

    // Raccoglie TUTTE le partite del giocatore nella finestra della Gameweek (così intercetta anche il DOPPIO MATCH!)
    let gwMatches = [];
    if (selectedGw && selectedGw.startDate && selectedGw.endDate) {
      const gwStart = new Date(selectedGw.startDate).getTime();
      const gwEnd = new Date(selectedGw.endDate).getTime();
      gwMatches = allowedGames.filter(g => g.timestamp >= gwStart && g.timestamp <= gwEnd);
    }

    const activeMatch = gwMatches[0] || null;
    const hasDoubleMatch = gwMatches.length >= 2;
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
        const aaStabilityBonus = Math.min(8, Math.max(0, card.avgAas || 12) * 0.22);
        const volatilityPenalty = Math.min(5, (card.stdDev || 0) * 0.12);
        baseProjection = ((baseL15 * 0.55) + (baseL5 * 0.45) + aaStabilityBonus - volatilityPenalty) * minutesFactor;
      }
      baseProjection = Math.min(78, Math.max(22, baseProjection));
    }

    const standbyScore = Number(Math.max(18, baseProjection * (card.powerMultiplier || 1)).toFixed(1));

    if (!activeMatch || card.isInjuredOrSuspended) {
      const detailedInsight = this.buildBespokeScoutingDossier(card, [], isCeiling, manualStatus, standbyScore, false, null);
      return {
        ...card,
        activeMatch: null,
        gwMatches: [],
        hasDoubleMatch: false,
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

    // Se TUTTE le partite della GW sono già state giocate con 0 minuti (DNP totale):
    const allPlayedAreDnpZero = gwMatches.every(m =>
      m.alreadyPlayedScore !== null &&
      m.alreadyPlayedScore === 0 &&
      (m.alreadyPlayedMins === 0 || m.alreadyPlayedMins === null)
    );

    if (allPlayedAreDnpZero) {
      const detailedInsight = this.buildBespokeScoutingDossier(card, gwMatches, isCeiling, manualStatus, 0, isNationalMatch, null);
      return {
        ...card,
        activeMatch: activeMatch,
        gwMatches: gwMatches,
        hasDoubleMatch: hasDoubleMatch,
        isHome: activeMatch.isHome,
        opponentName: activeMatch.opponentName,
        availabilityTier: 'dnp',
        manualStatus: manualStatus,
        isLastResort: true,
        unavailableReason: '0 pt (Panchina/DNP) nel match già disputato in questa GW',
        projectedScore: 0,
        standbyScore: 0,
        selectionPriority: 0,
        clubStandbyPriority: 0,
        matchupInsight: detailedInsight
      };
    }

    // Calcola il moltiplicatore dinamico del matchup (o del Doppio Match calibrato sulla forza delle 2 avversarie!)
    const matchPkg = this.evaluateGwMatchesPackage(gwMatches, card.position);
    let adjustedProjection = baseProjection * matchPkg.combinedMultiplier;

    let priorityTier = 3;
    let availabilityLabel = 'starter';

    if (manualStatus === 'xi') {
      priorityTier = 3;
      availabilityLabel = 'starter';
    } else if (isNationalMatch) {
      if (card.natFitnessTier === 'starter') {
        priorityTier = 3;
        availabilityLabel = 'starter';
      } else if (card.natFitnessTier === 'rotation') {
        priorityTier = 2;
        availabilityLabel = 'rotation';
        adjustedProjection *= 0.90;
      } else {
        // Giocatore con match di Nazionale ufficiale su Sorare ma senza presenze recenti in Nazionale:
        // Priorità 1 -> usato per completare la 3ª, 4ª e 5ª formazione!
        priorityTier = 1;
        availabilityLabel = 'rotation';
        adjustedProjection *= 0.80;
      }
    } else {
      if (card.baseFitnessTier === 'starter') {
        priorityTier = 3;
        availabilityLabel = 'starter';
      } else {
        priorityTier = 2;
        availabilityLabel = 'rotation';
        adjustedProjection *= 0.88;
      }
    }

    if (manualStatus === 'bench') {
      const benchScore = Number(Math.max(12, adjustedProjection * 0.45 * (card.powerMultiplier || 1)).toFixed(1));
      const detailedInsight = this.buildBespokeScoutingDossier(card, gwMatches, isCeiling, 'bench', benchScore, isNationalMatch, null);
      return {
        ...card,
        activeMatch: activeMatch,
        gwMatches: gwMatches,
        hasDoubleMatch: hasDoubleMatch,
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

    const projectedScore = Number(Math.max(18, adjustedProjection * (card.powerMultiplier || 1)).toFixed(1));
    const detailedInsight = this.buildBespokeScoutingDossier(card, gwMatches, isCeiling, manualStatus, projectedScore, isNationalMatch, null);

    return {
      ...card,
      activeMatch: activeMatch,
      gwMatches: gwMatches,
      hasDoubleMatch: hasDoubleMatch,
      doubleMatchBoostPct: matchPkg.doubleMatchBoostPct,
      isHome: activeMatch.isHome,
      opponentName: activeMatch.opponentName,
      availabilityTier: availabilityLabel,
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
