// SorareHub - Context-Aware Form Switcher (Strict National Form in Int. GW vs Strict Club Form in Club GW)
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

  analyzeSingleMatchupDifficulty(game, cardPosition) {
    if (!game) {
      return { multiplier: 1.0, difficultyScore: 0.5, summaryText: '' };
    }

    const venueFactor = game.isHome ? 1.035 : 0.985;
    const venueLabel = game.isHome ? 'in casa' : 'in trasferta';
    const oppForm = game.opponentForm;

    if (oppForm && oppForm.sampleSize >= 1 && oppForm.avgGa !== null) {
      const { avgGf, avgGa, recordStr, strengthIndex, sampleSize } = oppForm;
      let roleMod = 1.0;
      let tacticalNote = '';

      if (cardPosition === 'GK' || cardPosition === 'DEF') {
        if (avgGf >= 1.9) {
          roleMod = 0.96;
          tacticalNote = `avversaria prolifica (${avgGf} GF/gara nelle ultime ${sampleSize}, ${recordStr}): match impegnativo per la porta inviolata`;
        } else if (avgGf <= 0.95) {
          roleMod = 1.045;
          tacticalNote = `avversaria poco incisiva (${avgGf} GF/gara nelle ultime ${sampleSize}, ${recordStr}): alta probabilità di Clean Sheet`;
        } else {
          roleMod = 1.0 + ((0.55 - strengthIndex) * 0.06);
          tacticalNote = `avversaria equilibrata (${recordStr}, media ${avgGf} GF / ${avgGa} GS nelle ultime ${sampleSize})`;
        }
      } else {
        if (avgGa >= 1.75) {
          roleMod = 1.055;
          tacticalNote = `avversaria vulnerabile dietro (concede ${avgGa} gol/gara nelle ultime ${sampleSize}, ${recordStr}): scenario ideale per bonus offensivi`;
        } else if (avgGa <= 0.85 && strengthIndex >= 0.62) {
          roleMod = 0.965;
          tacticalNote = `avversaria solida dietro (solo ${avgGa} GS/gara nelle ultime ${sampleSize}, ${recordStr}): gara bloccata, decisiva la base AA`;
        } else {
          roleMod = 1.0 + ((0.55 - strengthIndex) * 0.06);
          tacticalNote = `avversaria con forma ${recordStr} (${avgGa} gol concessi/gara nelle ultime ${sampleSize})`;
        }
      }

      const finalMult = Number((venueFactor * roleMod).toFixed(3));
      return {
        multiplier: finalMult,
        difficultyScore: strengthIndex,
        summaryText: `${venueLabel} vs ${game.opponentName} [${tacticalNote}]`
      };
    }

    if (oppForm && typeof oppForm.strengthIndex === 'number') {
      const sIdx = oppForm.strengthIndex;
      const roleMod = 1.0 + ((0.55 - sIdx) * 0.07);
      const finalMult = Number((venueFactor * roleMod).toFixed(3));
      const levelDesc = sIdx >= 0.65 ? 'avversaria in ottimo stato di forma' : (sIdx <= 0.42 ? 'avversaria in flessione recente' : 'impegno equilibrato');
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

    const m1 = this.analyzeSingleMatchupDifficulty(gwMatches[0], cardPosition);
    const m2 = this.analyzeSingleMatchupDifficulty(gwMatches[1], cardPosition);

    const bestSingleMult = Math.max(m1.multiplier, m2.multiplier);
    const avgDifficulty = (m1.difficultyScore + m2.difficultyScore) / 2;

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

  // Dossier Analitico 100% SEPARATO per contesto:
  // - Se il match della GW è in Nazionale -> usa SOLO natStats (voti, minutaggi, avversari e archetipo in Nazionale!)
  // - Se il match della GW è col Club -> usa SOLO clubStats (voti ufficiali SO5 col Club, zero amichevoli e zero partite di Nazionale!)
  buildBespokeScoutingDossier(card, gwMatches, isCeiling, manualStatus, finalProjScore, isNationalMatch, lineupContext = null) {
    const matchesList = Array.isArray(gwMatches) ? gwMatches : [];
    const cStats = card.clubStats || {};
    const nStats = card.natStats || {};

    // Seleziona rigorosamente il dataset del contesto attivo (Nazionale vs Club)
    const activeStats = isNationalMatch
      ? (nStats.playedCount > 0 ? nStats : cStats)
      : cStats;
    const isUsingFallbackClubInNat = isNationalMatch && nStats.playedCount === 0;
    const contextLabel = isNationalMatch ? `in Nazionale (${card.nationalTeamName || 'Nazionale'})` : `nel ${card.club}`;
    const logs = Array.isArray(activeStats.matchLogs) ? activeStats.matchLogs : [];

    // 1. CONTINUITÀ & STRISCIA MINUTAGGIO SEPARATA PER CONTESTO
    const minsHistoryStr = logs.length > 0
      ? logs.slice(0, 5).map(m => `${m.mins}'`).join(' → ')
      : `${activeStats.avgMins || 0}' medi`;

    let statusSection = '';
    if (manualStatus === 'bench') {
      statusSection = `🪑 STATO: Escluso manualmente (Panchina).`;
    } else if (manualStatus === 'xi') {
      statusSection = `✅ STATO: Confermato nell'11 Titolare (${contextLabel} • Minutaggi: ${minsHistoryStr}).`;
    } else if (isNationalMatch) {
      if (nStats.playedCount > 0) {
        statusSection = `🌍 FORMA & TITOLARITÀ NAZIONALE: ${nStats.starterCount}/${nStats.totalEntries} dal 1' con la Nazionale (Minutaggi in Nazionale: ${minsHistoryStr} • Media Naz: ${nStats.avgScore} pt).`;
      } else {
        statusSection = `🌍 IMPIEGO NAZIONALE: Nessuna gara recente in Nazionale registrata su SO5 (Riferimento Club ${card.club}: ${cStats.starterCount || 0}/${cStats.totalEntries || 5} dal 1', L5 Club ${cStats.avgScore || card.l5} pt).`;
      }
    } else if (card.baseFitnessTier === 'starter') {
      statusSection = `✅ TITOLARITÀ CLUB (${card.club}): ${cStats.starterCount}/${cStats.totalEntries || 5} gare ufficiali dal 1' (Minutaggi Club: ${minsHistoryStr}).`;
    } else {
      statusSection = `⚠️ ROTAZIONE CLUB (${card.club}): ${cStats.playedCount}/${cStats.totalEntries || 5} presenze ufficiali SO5 (Minutaggi Club: ${minsHistoryStr}).`;
    }

    // 2. STORICO REALE DELLE ULTIME GARE DEL CONTESTO ATTIVO (Solo Nazionale se GW Nazionale, Solo Club se GW Club!)
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

      const logHeader = isNationalMatch
        ? (isUsingFallbackClubInNat ? `🗓️ ULTIME GARE CLUB (Rif. ${card.club})` : `🗓️ ULTIME GARE IN NAZIONALE`)
        : `🗓️ ULTIME GARE UFFICIALI CLUB (${card.club})`;
      recentLogSection = `${logHeader}: ${formattedLogs}.`;
    } else {
      recentLogSection = `🗓️ MEDIE STORICHE SO5: L15 ${card.l15} pt • Media contesto ${activeStats.avgScore || card.l5} pt.`;
    }

    // 3. ARCHETIPO TATTICO CALCOLATO SULLE STATISTICHE DEL CONTESTO ATTIVO
    const ctxAvgScore = activeStats.avgScore || card.l5 || card.l15;
    const ctxAvgAas = activeStats.avgAas ?? card.avgAas ?? 0;
    const ctxAvgDec = activeStats.avgDecisive ?? card.avgDecisive ?? 0;
    const ctxMax = activeStats.maxScore || card.maxRecentScore || 0;
    const ctxMin = activeStats.minScore || card.minRecentScore || 0;
    const ctxPlayed = activeStats.playedCount || 1;

    const formDelta = Number((ctxAvgScore - card.l15).toFixed(1));
    const formScopeLabel = isNationalMatch && !isUsingFallbackClubInNat ? 'Forma Nazionale' : 'Forma Club';
    const formTrendStr = formDelta >= 4.0
      ? `${formScopeLabel} superiore alla L15 (+${formDelta} pt: media ${ctxAvgScore} vs L15 ${card.l15})`
      : (formDelta <= -4.0
        ? `${formScopeLabel} inferiore alla L15 (${formDelta} pt: media ${ctxAvgScore} vs L15 ${card.l15})`
        : `${formScopeLabel} allineata alla L15 (${ctxAvgScore} pt vs ${card.l15} pt)`);

    let tacticalDnaSection = '';
    if (card.position === 'GK') {
      if ((activeStats.saves || 0) >= 8 || ctxAvgAas >= 10) {
        tacticalDnaSection = `🧤 PROFILO PORTIERE (Para-Tiri ad Alto AA): ${formTrendStr}. Nelle ultime ${ctxPlayed} gare ${contextLabel} ha sommato ${activeStats.saves || 0} parate e ${activeStats.cleanSheets || 0} Clean Sheet (+${ctxAvgAas} pt AA medi oltre i 35 base).`;
      } else {
        tacticalDnaSection = `🧤 PROFILO PORTIERE (Specialista Clean Sheet): ${formTrendStr}. Conta ${activeStats.cleanSheets || 0} porte inviolate nelle ultime ${ctxPlayed} gare ${contextLabel} (${activeStats.saves || 0} parate totali, picco ${ctxMax} pt).`;
      }
    } else if (card.position === 'DEF') {
      if ((activeStats.goals + activeStats.assists) >= 1 && ctxAvgDec >= 8) {
        tacticalDnaSection = `⚡ ARCHETIPO DIFENSIVO (Spinta & Bonus): ${formTrendStr}. Nelle ultime ${ctxPlayed} gare ${contextLabel} ha prodotto ${activeStats.goals} gol e ${activeStats.assists} assist, oltre a ${activeStats.avgDefActions || 0} interventi difensivi/gara (+${ctxAvgAas} pt AA medi).`;
      } else if ((activeStats.avgPasses || 0) >= 48 && ctxAvgAas >= 16) {
        tacticalDnaSection = `🎯 ARCHETIPO DIFENSIVO (Regista Difensivo / Costruttore dal Basso): ${formTrendStr}. Viaggia a ${activeStats.avgPasses} passaggi riusciti e ${activeStats.avgDuelsWon || 0} duelli vinti a gara ${contextLabel}, generando +${ctxAvgAas} pt di puro All-Around sopra i 35 pt base.`;
      } else if ((activeStats.avgDefActions || 0) >= 4.5 || (activeStats.avgDuelsWon || 0) >= 4.5 || ctxAvgAas >= 14) {
        tacticalDnaSection = `🛡️ ARCHETIPO DIFENSIVO (Stopper & Volume Interventi): ${formTrendStr}. Produce una media di ${activeStats.avgDefActions || 0} tra intercetti, contrasti e respinte e ${activeStats.avgDuelsWon || 0} duelli vinti a gara ${contextLabel} (+${ctxAvgAas} pt AA medi, picco ${ctxMax} pt).`;
      } else {
        tacticalDnaSection = `🧱 ARCHETIPO DIFENSIVO (Posizionale da Clean Sheet): ${formTrendStr}. Basa il voto sulla tenuta difensiva ${contextLabel} (${activeStats.cleanSheets || 0} Clean Sheet in ${ctxPlayed} gare, media +${ctxAvgAas} pt AA, range [${ctxMin}–${ctxMax}]).`;
      }
    } else if (card.position === 'MID') {
      if ((activeStats.goals + activeStats.assists) >= 2 && ctxAvgAas >= 18) {
        tacticalDnaSection = `👑 ARCHETIPO CENTROCAMPISTA (Tuttocampista Totale AA + Bonus): ${formTrendStr}. Combina +${ctxAvgAas} pt AA medi (${activeStats.avgPasses || 0} passaggi/gara) con ${activeStats.goals} gol e ${activeStats.assists} assist nelle ultime ${ctxPlayed} gare ${contextLabel} (picco ${ctxMax} pt).`;
      } else if ((activeStats.avgPasses || 0) >= 42 || ctxAvgAas >= 18) {
        tacticalDnaSection = `🧭 ARCHETIPO CENTROCAMPISTA (Metronomo da Pavimento Sicuro): ${formTrendStr}. Macina ${activeStats.avgPasses || 0} passaggi precisi e ${activeStats.avgDuelsWon || 0} duelli vinti a partita ${contextLabel}, garantendo +${ctxAvgAas} pt medi di All-Around puro anche senza bonus.`;
      } else if ((activeStats.goals + activeStats.assists) >= 1) {
        tacticalDnaSection = `⚡ ARCHETIPO CENTROCAMPISTA (Incursore Offensivo): ${formTrendStr}. Ha firmato ${activeStats.goals}G e ${activeStats.assists}A nelle ultime ${ctxPlayed} uscite ${contextLabel} (+${ctxAvgAas} pt AA e ${activeStats.avgShotsOnTarget || 0} tiri nello specchio/gara).`;
      } else {
        tacticalDnaSection = `⚙️ ARCHETIPO CENTROCAMPISTA (Mediano di Equilibrio): ${formTrendStr} (${activeStats.avgDefActions || 0} recuperi difensivi e ${activeStats.avgPasses || 0} passaggi di media ${contextLabel}, +${ctxAvgAas} pt AA, range [${ctxMin}–${ctxMax}]).`;
      }
    } else {
      if (ctxAvgAas >= 15 && (activeStats.goals + activeStats.assists) >= 1) {
        tacticalDnaSection = `🔥 ARCHETIPO OFFENSIVO (Ala Creativa / Attaccante Completo): ${formTrendStr}. Abbina ${activeStats.goals} reti e ${activeStats.assists} assist ${contextLabel} a +${ctxAvgAas} pt medi di All-Around tra dribbling, passaggi chiave e tiri (picco ${ctxMax} pt).`;
      } else if ((activeStats.goals + activeStats.assists) >= 1 || ctxAvgDec >= 12) {
        tacticalDnaSection = `🎯 ARCHETIPO OFFENSIVO (Finalizzatore d'Area): ${formTrendStr}. Incisivo sotto porta con ${activeStats.goals} gol e ${activeStats.assists} assist nelle ultime ${ctxPlayed} gare ${contextLabel} (+${ctxAvgDec} pt netti da bonus decisivi oltre il voto base).`;
      } else if (ctxAvgAas >= 11) {
        tacticalDnaSection = `⚡ ARCHETIPO OFFENSIVO (Attaccante di Manovra): ${formTrendStr}. Partecipa allo sviluppo offensivo ${contextLabel} generando +${ctxAvgAas} pt AA medi (${activeStats.avgDuelsWon || 0} duelli vinti/gara, range [${ctxMin}–${ctxMax}]).`;
      } else {
        tacticalDnaSection = `🏹 ARCHETIPO OFFENSIVO (Punta Centrale da Episodio): ${formTrendStr} (base AA +${ctxAvgAas} pt ${contextLabel}): scelto per attaccare la profondità e cercare il bonus pesante.`;
      }
    }

    // 4. ANALISI DINAMICA DELLE AVVERSARIE & EVENTUALE DOPPIO MATCH IN GW
    let matchupSection = '';
    if (matchesList.length === 0) {
      matchupSection = `⏸️ CALENDARIO GW: ${card.club} in sosta in questo turno (valutazione di riferimento Club: ${finalProjScore} pt).`;
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

    let gwMatches = [];
    if (selectedGw && selectedGw.startDate && selectedGw.endDate) {
      const gwStart = new Date(selectedGw.startDate).getTime();
      const gwEnd = new Date(selectedGw.endDate).getTime();
      gwMatches = allowedGames.filter(g => g.timestamp >= gwStart && g.timestamp <= gwEnd);
    }

    const activeMatch = gwMatches[0] || null;
    const hasDoubleMatch = gwMatches.length >= 2;
    const isNationalMatch = Boolean(activeMatch && activeMatch.isNationalTeam);
    const isCeiling = String(strategy || '').toLowerCase() === 'ceiling';

    // SELEZIONE RIGOROSA DEL PROFILO DI FORMA (Nazionale se GW Nazionale, Club se GW Club!)
    const activeProfileStats = isNationalMatch
      ? ((card.natStats && card.natStats.playedCount > 0) ? card.natStats : card.clubStats)
      : card.clubStats;

    const contextL5 = activeProfileStats?.avgScore > 0 ? activeProfileStats.avgScore : (card.clubL5 || card.l15 || 35);
    const baseL15 = card.l15 > 0 ? card.l15 : contextL5;
    const contextAas = activeProfileStats?.avgAas ?? card.avgAas ?? 12;
    const contextMax = activeProfileStats?.maxScore || card.maxRecentScore || contextL5;
    const contextStdDev = activeProfileStats?.stdDev ?? card.stdDev ?? 0;
    const contextMins = activeProfileStats?.avgMins || card.avgMins || 70;
    const contextCleanSheets = activeProfileStats?.cleanSheets ?? card.tacticalTraits?.cleanSheets ?? 0;
    const contextSaves = activeProfileStats?.saves ?? card.tacticalTraits?.saves ?? 0;

    let baseProjection = 0;
    if (card.position === 'GK') {
      const gkForm = (baseL15 * 0.45) + (contextL5 * 0.55);
      const csBonus = contextCleanSheets * 1.4;
      const savesBonus = Math.min(4, contextSaves * 0.25);
      baseProjection = Math.min(72, Math.max(32, gkForm + csBonus + savesBonus));
    } else {
      const minutesFactor = contextMins >= 82
        ? 1.03
        : (contextMins >= 68 ? 1.00 : (contextMins >= 45 ? 0.88 : 0.72));

      if (isCeiling) {
        const peakRef = contextMax > 0 ? Math.min(90, contextMax) : contextL5;
        baseProjection = ((contextL5 * 0.50) + (baseL15 * 0.30) + (peakRef * 0.20)) * minutesFactor;
      } else {
        const aaStabilityBonus = Math.min(8, Math.max(0, contextAas) * 0.22);
        const volatilityPenalty = Math.min(5, contextStdDev * 0.12);
        baseProjection = ((contextL15Weight(baseL15, contextL5, isNationalMatch)) + aaStabilityBonus - volatilityPenalty) * minutesFactor;
      }
      baseProjection = Math.min(78, Math.max(22, baseProjection));
    }

    function contextL15Weight(l15Val, ctxL5Val, isNat) {
      // In Nazionale pesa al 65% la Forma Nazionale specifica e al 35% la L15 generale; nel Club 50% L5 Club e 50% L15
      return isNat ? ((ctxL5Val * 0.65) + (l15Val * 0.35)) : ((ctxL5Val * 0.52) + (l15Val * 0.48));
    }

    const standbyScore = Number(Math.max(18, baseProjection * (card.powerMultiplier || 1)).toFixed(1));

    if (!activeMatch || card.isInjuredOrSuspended) {
      const detailedInsight = this.buildBespokeScoutingDossier(card, [], isCeiling, manualStatus, standbyScore, false, null);
      return {
        ...card,
        activeMatch: null,
        gwMatches: [],
        hasDoubleMatch: false,
        contextFormLabel: 'L5 Club',
        contextFormScore: card.clubL5 || card.l5,
        contextAas: card.clubStats?.avgAas ?? card.avgAas,
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
        contextFormLabel: isNationalMatch ? 'Forma Naz' : 'Forma Club',
        contextFormScore: contextL5,
        contextAas: contextAas,
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
        contextFormLabel: isNationalMatch ? 'Forma Naz' : 'Forma Club',
        contextFormScore: contextL5,
        contextAas: contextAas,
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
      contextFormLabel: isNationalMatch ? 'Forma Naz' : 'Forma Club',
      contextFormScore: contextL5,
      contextAas: contextAas,
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
