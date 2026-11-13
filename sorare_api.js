// SorareHub - Full GW Window (Past + Live + Upcoming Matches in GW) & Role-Specific Opta Analytics
const SorareAPI = {
  CACHE_KEY: 'sorarehub_gallery_cache_v18',
  CACHE_TTL_MS: 12 * 60 * 1000, // 12 minuti

  generateRandomString(length = 32) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, v => charset[v % charset.length]).join('');
  },

  async startOAuthFlow() {
    if (localStorage.getItem('sorare_access_token')) {
      if (window.App && App.loadUserGallery) {
        App.loadUserGallery(true);
        return;
      }
    }

    const state = this.generateRandomString(16);
    localStorage.setItem('sorare_oauth_state', state);

    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      redirect_uri: CONFIG.REDIRECT_URI,
      response_type: 'code',
      scope: CONFIG.SCOPES,
      state: state
    });

    window.location.href = `${CONFIG.AUTH_ENDPOINT}?${params.toString()}`;
  },

  async handleOAuthCallback(code) {
    if (!code) {
      const urlParams = new URLSearchParams(window.location.search);
      code = urlParams.get('code');
    }

    if (!code) {
      return localStorage.getItem('sorare_access_token') || null;
    }

    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append('client_id', CONFIG.CLIENT_ID);
      bodyParams.append('grant_type', 'authorization_code');
      bodyParams.append('code', code);
      bodyParams.append('redirect_uri', CONFIG.REDIRECT_URI);

      const response = await fetch(CONFIG.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });

      if (!response.ok) {
        const errTxt = await response.text();
        throw new Error(`Errore dal Worker (${response.status}): ${errTxt}`);
      }

      const tokenData = await response.json();
      if (tokenData.access_token) {
        localStorage.setItem('sorare_access_token', tokenData.access_token);
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return tokenData.access_token;
      } else {
        throw new Error('Nessun access_token nella risposta del Worker');
      }
    } catch (err) {
      console.error('Errore OAuth:', err);
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      if (window.App && App.notify) {
        App.notify('❌ ' + err.message, true);
      }
      return null;
    }
  },

  async fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, options);
      if (res.status !== 429) {
        return res;
      }
      if (attempt < maxRetries) {
        const waitMs = 2500 * (attempt + 1);
        if (window.App && App.notify) {
          App.notify(`⏳ Limite richieste Sorare (429): riprovo tra ${Math.round(waitMs / 1000)}s...`);
        }
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        return res;
      }
    }
  },

  // Calendario Ufficiale Sorare:
  // Midweek: Martedì 16:00 CET (15:00 UTC) -> Venerdì 15:59 CET (14:59 UTC)
  // Weekend: Venerdì 16:00 CET (15:00 UTC) -> Martedì 15:59 CET (14:59 UTC)
  buildOfficialSorareGameweeks(officialGwNumber = null) {
    const now = new Date();
    const anchorStartMs = Date.UTC(2026, 10, 10, 15, 0, 0); // Mar 10 Nov 2026 16:00 CET = GW #524
    const anchorGwNum = officialGwNumber || 524;

    const boundaries = [];
    let cursorMs = anchorStartMs - (14 * 24 * 3600 * 1000);
    let gwCounter = anchorGwNum - 4;

    for (let i = 0; i < 24; i++) {
      const d = new Date(cursorMs);
      const dayOfWeek = d.getUTCDay(); // 2 = Martedì, 5 = Venerdì
      const durationHours = (dayOfWeek === 2) ? 72 : 96;
      const nextMs = cursorMs + durationHours * 3600 * 1000;

      boundaries.push({
        gameWeek: gwCounter,
        startMs: cursorMs,
        endMs: nextMs - 1000
      });

      cursorMs = nextMs;
      gwCounter++;
    }

    const nowMs = now.getTime();
    let activeIdx = boundaries.findIndex(b => nowMs >= b.startMs && nowMs <= b.endMs);
    if (activeIdx === -1) {
      activeIdx = boundaries.findIndex(b => b.startMs >= nowMs);
      if (activeIdx === -1) activeIdx = 4;
    }

    return [0, 1, 2].map(offset => {
      const b = boundaries[activeIdx + offset];
      const startIso = new Date(b.startMs).toISOString();
      const endIso = new Date(b.endMs).toISOString();
      const statusTag = offset === 0 ? 'Live' : (offset === 1 ? 'Prossima' : 'Futuro');
      return {
        index: offset,
        gameWeek: b.gameWeek,
        label: `GW #${b.gameWeek} (${statusTag})`,
        startDate: startIso,
        endDate: endIso,
        dateRangeText: this.formatDateRange(startIso, endIso)
      };
    });
  },

  formatDateRange(startStr, endStr) {
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const opts = { day: '2-digit', month: 'short' };
      return `${s.toLocaleDateString('it-IT', opts)} - ${e.toLocaleDateString('it-IT', opts)}`;
    } catch (_) {
      return '';
    }
  },

  async fetchCurrentUserGallery(forceRefresh = false) {
    const token = localStorage.getItem('sorare_access_token');
    if (!token) return null;

    if (!forceRefresh) {
      try {
        const cachedRaw = localStorage.getItem(this.CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && cached.timestamp && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS && Array.isArray(cached.cards) && cached.cards.length > 0) {
            return {
              user: cached.user,
              gameweeks: this.buildOfficialSorareGameweeks(),
              cards: cached.cards
            };
          }
        }
      } catch (_) {}
    }

    const workerGraphqlEndpoint = `${CONFIG.TOKEN_ENDPOINT.replace(/\/$/, '')}/graphql`;

    // Include anche game dentro so5Scores(last: 5) così i match già giocati ieri/avantieri dentro la GW Live vengono rilevati sempre!
    const pagedQuery = `
      query GetCurrentUserCards($after: String) {
        currentUser {
          slug
          nickname
          cards(first: 45, after: $after, rarities: [limited, rare, super_rare, unique]) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              slug
              name
              rarityTyped
              seasonYear
              inSeasonUntil
              power
              anyPositions
              pictureUrl
              ... on Card {
                player {
                  displayName
                  slug
                  birthDate
                  pictureUrl
                  l5: averageScore(type: LAST_FIVE_SO5_AVERAGE_SCORE)
                  l15: averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
                  activeInjuries {
                    status
                  }
                  activeSuspensions {
                    reason
                  }
                  so5Scores(last: 5) {
                    score
                    decisiveScore {
                      totalScore
                    }
                    playerGameStats {
                      minsPlayed
                      goals
                      goalAssist
                      cleanSheet
                      saves
                    }
                    game {
                      date
                      competition {
                        slug
                        displayName
                      }
                      homeTeam {
                        ... on TeamInterface {
                          slug
                          name
                        }
                      }
                      awayTeam {
                        ... on TeamInterface {
                          slug
                          name
                        }
                      }
                    }
                  }
                  activeClub {
                    name
                    slug
                    domesticLeague {
                      slug
                      displayName
                    }
                    upcomingGames(first: 4) {
                      date
                      competition {
                        slug
                        displayName
                      }
                      homeTeam {
                        ... on TeamInterface {
                          slug
                          name
                        }
                      }
                      awayTeam {
                        ... on TeamInterface {
                          slug
                          name
                        }
                      }
                    }
                  }
                  activeNationalTeam {
                    name
                    slug
                    upcomingGames(first: 4) {
                      date
                      competition {
                        slug
                        displayName
                      }
                      homeTeam {
                        ... on TeamInterface {
                          slug
                          name
                        }
                      }
                      awayTeam {
                        ... on TeamInterface {
                          slug
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    let allCards = [];
    let hasNext = true;
    let cursor = null;
    let userProfile = null;
    let batchIndex = 0;

    while (hasNext && batchIndex < 20) {
      batchIndex++;

      const res = await this.fetchWithRetry(workerGraphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: pagedQuery,
          variables: { after: cursor }
        })
      }, 3);

      if (!res || !res.ok) {
        const errBody = res ? await res.text() : 'Nessuna risposta';
        if (res && res.status === 401) {
          localStorage.removeItem('sorare_access_token');
        }
        throw new Error(`Errore API Sorare (${res ? res.status : 'NET'}): ${errBody}`);
      }

      const json = await res.json();
      if (json.errors && json.errors.length > 0) {
        console.error('Errore GraphQL:', json.errors);
        throw new Error(json.errors[0].message);
      }

      const currentUser = json.data?.currentUser;
      if (!currentUser) break;

      if (!userProfile) {
        userProfile = { slug: currentUser.slug, nickname: currentUser.nickname };
      }

      const connection = currentUser.cards;
      const nodes = connection?.nodes || [];
      if (nodes.length === 0) break;

      const proNodes = nodes.filter(n => String(n?.rarityTyped || '').toLowerCase() !== 'common');
      allCards = allCards.concat(proNodes);

      const loginBtnText = document.getElementById('login-btn-text');
      if (loginBtnText) {
        loginBtnText.textContent = `📥 Caricate ${allCards.length} carte Pro...`;
      }
      if (window.App && App.notify) {
        App.notify(`📥 Analisi Opta: ${allCards.length} carte Pro...`);
      }

      const pageInfo = connection?.pageInfo;
      hasNext = Boolean(pageInfo?.hasNextPage) && Boolean(pageInfo?.endCursor);
      cursor = pageInfo?.endCursor || null;

      if (!hasNext || !cursor) break;

      await new Promise(resolve => setTimeout(resolve, 450));
    }

    const enriched = this.enrichCardsWithRealOptaData(allCards)
      .filter(c => c.scarcity !== 'common');

    const gameweeks = this.buildOfficialSorareGameweeks();

    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        user: userProfile,
        gameweeks: gameweeks,
        cards: enriched
      }));
    } catch (_) {}

    return {
      user: userProfile,
      gameweeks: gameweeks,
      cards: enriched
    };
  },

  enrichCardsWithRealOptaData(rawCards) {
    const nowMs = Date.now();
    const NATIONAL_COMP_KEYWORDS = ['nations-league', 'world-cup', 'euro', 'qualification', 'international', 'friendlies', 'copa-america', 'africa-cup', 'conmebol', 'concacaf', 'uefa-nations'];

    return (rawCards || [])
      .filter(c => c && (c.name || c.player?.displayName))
      .map((card, index) => {
        const player = card.player || {};
        const playerName = player.displayName || card.name || 'Calciatore';
        const canonicalPlayerSlug = (player.slug || playerName.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();
        const rawPos = (card.anyPositions && card.anyPositions[0]) || 'FORWARD';
        const pos = this.normalizePosition(rawPos);

        const club = player.activeClub || {};
        const clubName = club.name || 'Svincolato / N.D.';
        const clubSlug = club.slug || 'no-club';
        const leagueSlug = (club.domesticLeague?.slug || 'other').toLowerCase();
        const leagueName = club.domesticLeague?.displayName || leagueSlug;

        const natTeam = player.activeNationalTeam || {};
        const natSlug = natTeam.slug || '';
        const natName = natTeam.name || '';

        const scheduleGames = [];
        const seenGameKeys = new Set();

        const pushUniqueGame = (g, isNatSource, alreadyPlayedScore = null) => {
          if (!g || !g.date) return;
          const ts = new Date(g.date).getTime();
          if (!ts || Number.isNaN(ts)) return;

          const homeSlug = g.homeTeam?.slug || '';
          const awaySlug = g.awayTeam?.slug || '';
          const homeName = g.homeTeam?.name || 'Casa';
          const awayName = g.awayTeam?.name || 'Trasferta';
          const compSlug = String(g.competition?.slug || '').toLowerCase();
          const compName = g.competition?.displayName || g.competition?.slug || 'Match';

          const dayKey = new Date(ts).toISOString().slice(0, 10);
          const dedupKey = `${dayKey}_${homeSlug || homeName}_${awaySlug || awayName}`;
          if (seenGameKeys.has(dedupKey)) return;
          seenGameKeys.add(dedupKey);

          // Determina se è una partita di Nazionale (sia da activeNationalTeam sia dai match già giocati in so5Scores durante la GW)
          const matchesNatTeam = Boolean(natSlug && (homeSlug === natSlug || awaySlug === natSlug));
          const matchesClubTeam = Boolean(clubSlug && (homeSlug === clubSlug || awaySlug === clubSlug));
          const isCompNational = NATIONAL_COMP_KEYWORDS.some(k => compSlug.includes(k));
          const isNationalMatch = isNatSource || matchesNatTeam || (!matchesClubTeam && isCompNational);

          if (isNationalMatch) {
            const isHome = natSlug ? (homeSlug === natSlug) : true;
            const myNatName = natName || (isHome ? homeName : awayName);
            const oppName = isHome ? awayName : homeName;
            scheduleGames.push({
              date: g.date,
              timestamp: ts,
              competitionSlug: compSlug || 'international',
              competitionName: compName || 'Nazionale',
              isHome: isHome,
              opponentName: oppName,
              opponentSlug: isHome ? awaySlug : homeSlug,
              isNationalTeam: true,
              alreadyPlayedScore: alreadyPlayedScore,
              teamName: `${myNatName} vs ${oppName}`
            });
          } else {
            const isHome = homeSlug === clubSlug;
            scheduleGames.push({
              date: g.date,
              timestamp: ts,
              competitionSlug: compSlug,
              competitionName: compName || 'Club',
              isHome: isHome,
              opponentName: isHome ? awayName : homeName,
              opponentSlug: isHome ? awaySlug : homeSlug,
              isNationalTeam: false,
              alreadyPlayedScore: alreadyPlayedScore,
              teamName: clubName
            });
          }
        };

        // 1) Partite future o imminenti da activeClub e activeNationalTeam
        (Array.isArray(club.upcomingGames) ? club.upcomingGames : []).forEach(g => pushUniqueGame(g, false, null));
        (Array.isArray(natTeam.upcomingGames) ? natTeam.upcomingGames : []).forEach(g => pushUniqueGame(g, true, null));

        // 2) Partite già disputate ieri/oggi dentro la stessa GW (recuperate da so5Scores)
        const allRecentScores = Array.isArray(player.so5Scores) ? player.so5Scores : [];
        allRecentScores.forEach(s => {
          if (s && s.game && s.game.date) {
            const sc = typeof s.score === 'number' ? Number(s.score.toFixed(1)) : null;
            pushUniqueGame(s.game, false, sc);
          }
        });

        scheduleGames.sort((a, b) => a.timestamp - b.timestamp);

        const rawSeasonStr = String(card.seasonYear || '');
        const parsedYearMatch = rawSeasonStr.match(/20\d{2}/);
        const sYear = parsedYearMatch ? Number(parsedYearMatch[0]) : 0;
        const slugHasCurrentSeason = String(card.slug || '').includes('-2026-');
        const inSeasonUntilMs = card.inSeasonUntil ? new Date(card.inSeasonUntil).getTime() : 0;

        const isInSeason =
          (inSeasonUntilMs > nowMs) ||
          (sYear >= 2026) ||
          slugHasCurrentSeason;

        const birthTime = player.birthDate ? new Date(player.birthDate).getTime() : 0;
        const u23Cutoff = new Date('2003-07-01').getTime();
        const isU23 = birthTime > 0 ? birthTime >= u23Cutoff : false;

        const last5Window = allRecentScores.slice(0, 5);
        const playedMatchesAll = allRecentScores.filter(s => {
          if (!s) return false;
          const sc = typeof s.score === 'number' ? s.score : 0;
          const mins = typeof s.playerGameStats?.minsPlayed === 'number' ? s.playerGameStats.minsPlayed : 0;
          return sc > 0 || mins > 0;
        });

        const apiL5 = typeof player.l5 === 'number' ? Number(player.l5.toFixed(1)) : 0;
        const computedL5 = playedMatchesAll.length > 0
          ? Number((playedMatchesAll.reduce((acc, m) => acc + (m.score || 0), 0) / playedMatchesAll.length).toFixed(1))
          : 0;
        const l5 = computedL5 > 0 ? computedL5 : apiL5;

        const apiL15 = typeof player.l15 === 'number' ? Number(player.l15.toFixed(1)) : 0;
        const l15 = apiL15 > 0 ? Math.max(apiL15, Number(((apiL15 + computedL5) / 2).toFixed(1))) : computedL5;

        let playedInLast5Games = 0;
        let starterCount = 0;
        let totalMins = 0;
        let sumAas = 0;
        let sumDecisive = 0;
        let maxRecentScore = 0;
        let minRecentScore = 100;
        let validScoreValues = [];

        let totalGoals = 0;
        let totalAssists = 0;
        let totalCleanSheets = 0;
        let totalSaves = 0;

        last5Window.forEach(s => {
          if (!s) return;
          const sc = typeof s.score === 'number' ? s.score : 0;
          const stats = s.playerGameStats || {};
          const mins = typeof stats.minsPlayed === 'number' ? stats.minsPlayed : (sc > 0 ? 60 : 0);

          if (mins > 0 || sc > 0) {
            playedInLast5Games++;
            totalMins += mins;
            if (mins >= 55) starterCount++;
            validScoreValues.push(sc);
            if (sc > maxRecentScore) maxRecentScore = sc;
            if (sc < minRecentScore) minRecentScore = sc;

            const dec = typeof s.decisiveScore?.totalScore === 'number' ? s.decisiveScore.totalScore : 0;
            const aas = Math.max(0, Number((sc - dec).toFixed(1)));
            sumAas += aas;
            sumDecisive += dec;

            totalGoals += stats.goals || 0;
            totalAssists += stats.goalAssist || 0;
            totalCleanSheets += stats.cleanSheet || 0;
            totalSaves += stats.saves || 0;
          }
        });

        if (validScoreValues.length === 0) minRecentScore = 0;

        const avgMins = playedInLast5Games > 0 ? Math.round(totalMins / playedInLast5Games) : 0;
        const avgAas = playedInLast5Games > 0 ? Number((sumAas / playedInLast5Games).toFixed(1)) : 0;
        const avgDecisive = playedInLast5Games > 0 ? Number((sumDecisive / playedInLast5Games).toFixed(1)) : 0;

        let stdDev = 0;
        if (validScoreValues.length > 1) {
          const mean = validScoreValues.reduce((a, b) => a + b, 0) / validScoreValues.length;
          const variance = validScoreValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / validScoreValues.length;
          stdDev = Number(Math.sqrt(variance).toFixed(1));
        }

        const injuries = Array.isArray(player.activeInjuries) ? player.activeInjuries : [];
        const suspensions = Array.isArray(player.activeSuspensions) ? player.activeSuspensions : [];
        const isInjured = injuries.length > 0;
        const isSuspended = suspensions.length > 0;
        const isInjuredOrSuspended = isInjured || isSuspended;

        let baseFitnessTier = 'last_resort';
        let baseUnavailableReason = '';

        if (isInjured) {
          baseUnavailableReason = 'Infortunato (Ufficiale Sorare)';
        } else if (isSuspended) {
          baseUnavailableReason = 'Squalificato (Ufficiale Sorare)';
        } else if (!club.slug && !natSlug && scheduleGames.length === 0) {
          baseUnavailableReason = 'Senza club/nazionale attiva';
        } else if (l5 <= 0 && playedInLast5Games === 0) {
          baseUnavailableReason = '0 presenze nelle ultime 5 gare';
        } else if (starterCount >= 3 || (playedInLast5Games >= 3 && avgMins >= 62)) {
          baseFitnessTier = 'starter';
        } else if (playedInLast5Games >= 1 || l5 > 0) {
          baseFitnessTier = 'rotation';
        } else {
          baseUnavailableReason = 'Fuori dalle rotazioni recenti';
        }

        // Lettura tattica realistica e differenziata per ruolo (Niente "Battitore piazzati" su DC come Otamendi, e niente Clean Sheet su CC/ATT!)
        const isAerialDominator = pos === 'DEF' && playedInLast5Games > 0 && (totalGoals >= 1 || avgAas >= 20);
        const isDefensiveWall = pos === 'DEF' && playedInLast5Games > 0 && avgAas >= 22;
        const isPlaymakerCreator = pos === 'MID' && playedInLast5Games > 0 && (avgAas >= 24 || totalAssists >= 1);
        const isBoxToBoxEngine = pos === 'MID' && playedInLast5Games > 0 && avgAas >= 19 && avgMins >= 75;
        const isClinicalFinisher = (pos === 'FWD' || pos === 'MID') && playedInLast5Games > 0 && ((totalGoals + totalAssists) >= 2 || avgDecisive >= 25);
        const isTargetPenaltyBox = pos === 'FWD' && playedInLast5Games > 0 && (totalGoals >= 1 || maxRecentScore >= 68);
        const isShotStopper = pos === 'GK' && playedInLast5Games > 0 && (totalSaves >= 10 || avgAas >= 18);

        const rawPower = parseFloat(card.power) || (isInSeason ? 1.05 : 1.00);
        const totalBonusPct = Math.round((rawPower - 1) * 100);

        return {
          id: card.slug || `c_${index}`,
          playerSlug: canonicalPlayerSlug,
          name: playerName,
          pictureUrl: card.pictureUrl || player.pictureUrl || null,
          club: clubName,
          clubSlug: clubSlug,
          leagueSlug: leagueSlug,
          leagueName: leagueName,
          scheduleGames: scheduleGames,
          position: pos,
          scarcity: (card.rarityTyped || 'limited').toLowerCase(),
          seasonYear: sYear,
          isInSeason: isInSeason,
          isU23: isU23,
          isInjuredOrSuspended: isInjuredOrSuspended,
          l5: l5,
          l15: l15,
          avgAas: avgAas,
          avgDecisive: avgDecisive,
          maxRecentScore: Math.round(maxRecentScore),
          minRecentScore: Math.round(minRecentScore),
          stdDev: stdDev,
          playedCount: playedInLast5Games,
          starterCount: starterCount,
          avgMins: avgMins,
          baseFitnessTier: baseFitnessTier,
          baseUnavailableReason: baseUnavailableReason,
          tacticalTraits: {
            aerialDominator: isAerialDominator,
            defensiveWall: isDefensiveWall,
            playmakerCreator: isPlaymakerCreator,
            boxToBoxEngine: isBoxToBoxEngine,
            clinicalFinisher: isClinicalFinisher,
            targetPenaltyBox: isTargetPenaltyBox,
            shotStopper: isShotStopper,
            cleanSheets: totalCleanSheets,
            goals: totalGoals,
            assists: totalAssists,
            saves: totalSaves
          },
          bonusPct: totalBonusPct,
          powerMultiplier: 1 + (totalBonusPct / 100)
        };
      });
  },

  normalizePosition(rawPos) {
    const p = String(rawPos || '').toUpperCase();
    if (p.includes('GOAL') || p === 'GK') return 'GK';
    if (p.includes('DEF') || p === 'DF') return 'DEF';
    if (p.includes('MID') || p === 'MF') return 'MID';
    return 'FWD';
  }
};

window.SorareAPI = SorareAPI;
