// SorareHub - Separate Club vs National Team Stats + Full GW Match Tracking + Official Lineup Detection
const SorareAPI = {
  CACHE_KEY: 'sorarehub_gallery_cache_v19',
  CACHE_TTL_MS: 10 * 60 * 1000, // 10 minuti

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

    // Interroga le ultime 10 partite (so5Scores(last: 10)) per separare con precisione il rendimento/titolarità nel CLUB da quello in NAZIONALE
    const pagedQuery = `
      query GetCurrentUserCards($after: String) {
        currentUser {
          slug
          nickname
          cards(first: 40, after: $after, rarities: [limited, rare, super_rare, unique]) {
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
                  so5Scores(last: 10) {
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

    while (hasNext && batchIndex < 22) {
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
        App.notify(`📥 Analisi Opta (Club vs Nazionale): ${allCards.length} carte Pro...`);
      }

      const pageInfo = connection?.pageInfo;
      hasNext = Boolean(pageInfo?.hasNextPage) && Boolean(pageInfo?.endCursor);
      cursor = pageInfo?.endCursor || null;

      if (!hasNext || !cursor) break;

      await new Promise(resolve => setTimeout(resolve, 420));
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
    const NATIONAL_COMP_KEYWORDS = [
      'nations-league',
      'world-cup',
      'euro',
      'qualification',
      'international',
      'friendlies',
      'copa-america',
      'africa-cup',
      'conmebol',
      'concacaf',
      'uefa-nations',
      'asian-cup'
    ];

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

        const isGameNational = (g, isNatSource = false) => {
          if (isNatSource) return true;
          if (!g) return false;
          const homeSlug = g.homeTeam?.slug || '';
          const awaySlug = g.awayTeam?.slug || '';
          const compSlug = String(g.competition?.slug || '').toLowerCase();
          const matchesNatTeam = Boolean(natSlug && (homeSlug === natSlug || awaySlug === natSlug));
          const matchesClubTeam = Boolean(clubSlug && (homeSlug === clubSlug || awaySlug === clubSlug));
          const isCompNational = NATIONAL_COMP_KEYWORDS.some(k => compSlug.includes(k));
          return matchesNatTeam || (!matchesClubTeam && isCompNational);
        };

        const scheduleGames = [];
        const seenGameKeys = new Set();

        const pushUniqueGame = (g, isNatSource, alreadyPlayedScore = null, alreadyPlayedMins = null) => {
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

          const isNationalMatch = isGameNational(g, isNatSource);

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
              alreadyPlayedMins: alreadyPlayedMins,
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
              alreadyPlayedMins: alreadyPlayedMins,
              teamName: clubName
            });
          }
        };

        // 1) Prima inseriamo i match da so5Scores (così se un match della GW è già stato giocato, conserva il punteggio reale e i minuti reali!)
        const allRecentScores = Array.isArray(player.so5Scores) ? player.so5Scores : [];
        allRecentScores.forEach(s => {
          if (s && s.game && s.game.date) {
            const sc = typeof s.score === 'number' ? Number(s.score.toFixed(1)) : 0;
            const mins = typeof s.playerGameStats?.minsPlayed === 'number' ? s.playerGameStats.minsPlayed : 0;
            pushUniqueGame(s.game, false, sc, mins);
          }
        });

        // 2) Poi inseriamo i match futuri da activeClub e activeNationalTeam
        (Array.isArray(club.upcomingGames) ? club.upcomingGames : []).forEach(g => pushUniqueGame(g, false, null, null));
        (Array.isArray(natTeam.upcomingGames) ? natTeam.upcomingGames : []).forEach(g => pushUniqueGame(g, true, null, null));

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

        // Separa rigorosamente le statistiche di CLUB da quelle di NAZIONALE
        const clubScoreEntries = [];
        const natScoreEntries = [];

        allRecentScores.forEach(s => {
          if (!s) return;
          if (isGameNational(s.game, false)) {
            natScoreEntries.push(s);
          } else {
            clubScoreEntries.push(s);
          }
        });

        const computeSplitMetrics = (entries, maxWindow = 5) => {
          const slice = entries.slice(0, maxWindow);
          let totalEntries = slice.length;
          let playedCount = 0;
          let starterCount = 0;
          let dnpZeroCount = 0;
          let totalMins = 0;
          let sumScores = 0;
          let sumAas = 0;
          let sumDecisive = 0;
          let maxScore = 0;
          let minScore = 100;
          const validScores = [];

          let goals = 0;
          let assists = 0;
          let cleanSheets = 0;
          let saves = 0;

          slice.forEach(s => {
            const sc = typeof s.score === 'number' ? s.score : 0;
            const stats = s.playerGameStats || {};
            const mins = typeof stats.minsPlayed === 'number' ? stats.playerGameStats?.minsPlayed ?? stats.minsPlayed : (sc > 0 ? 60 : 0);

            if (mins > 0 || sc > 0) {
              playedCount++;
              totalMins += mins;
              if (mins >= 55) starterCount++;
              sumScores += sc;
              validScores.push(sc);
              if (sc > maxScore) maxScore = sc;
              if (sc < minScore) minScore = sc;

              const dec = typeof s.decisiveScore?.totalScore === 'number' ? s.decisiveScore.totalScore : 0;
              const aas = Math.max(0, Number((sc - dec).toFixed(1)));
              sumAas += aas;
              sumDecisive += dec;

              goals += stats.goals || 0;
              assists += stats.goalAssist || 0;
              cleanSheets += stats.cleanSheet || 0;
              saves += stats.saves || 0;
            } else {
              dnpZeroCount++;
            }
          });

          if (validScores.length === 0) minScore = 0;
          const avgScore = playedCount > 0 ? Number((sumScores / playedCount).toFixed(1)) : 0;
          const avgMins = playedCount > 0 ? Math.round(totalMins / playedCount) : 0;
          const avgAas = playedCount > 0 ? Number((sumAas / playedCount).toFixed(1)) : 0;
          const avgDecisive = playedCount > 0 ? Number((sumDecisive / playedCount).toFixed(1)) : 0;

          let stdDev = 0;
          if (validScores.length > 1) {
            const mean = validScores.reduce((a, b) => a + b, 0) / validScores.length;
            const variance = validScores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / validScores.length;
            stdDev = Number(Math.sqrt(variance).toFixed(1));
          }

          return {
            totalEntries,
            playedCount,
            starterCount,
            dnpZeroCount,
            avgScore,
            avgMins,
            avgAas,
            avgDecisive,
            maxScore: Math.round(maxScore),
            minScore: Math.round(minScore),
            stdDev,
            goals,
            assists,
            cleanSheets,
            saves
          };
        };

        const clubStats = computeSplitMetrics(clubScoreEntries.length > 0 ? clubScoreEntries : allRecentScores, 5);
        const natStats = computeSplitMetrics(natScoreEntries, 5);

        const apiL5 = typeof player.l5 === 'number' ? Number(player.l5.toFixed(1)) : 0;
        const l5 = clubStats.avgScore > 0 ? clubStats.avgScore : apiL5;
        const apiL15 = typeof player.l15 === 'number' ? Number(player.l15.toFixed(1)) : 0;
        const l15 = apiL15 > 0 ? apiL15 : l5;

        const injuries = Array.isArray(player.activeInjuries) ? player.activeInjuries : [];
        const suspensions = Array.isArray(player.activeSuspensions) ? player.activeSuspensions : [];
        const isInjured = injuries.length > 0;
        const isSuspended = suspensions.length > 0;
        const isInjuredOrSuspended = isInjured || isSuspended;

        // Titolarità specifica nel CLUB
        let clubFitnessTier = 'last_resort';
        if (!isInjuredOrSuspended) {
          if (clubStats.starterCount >= 3 || (clubStats.playedCount >= 3 && clubStats.avgMins >= 62)) {
            clubFitnessTier = 'starter';
          } else if (clubStats.playedCount >= 1 || l5 > 0) {
            clubFitnessTier = 'rotation';
          }
        }

        // Titolarità specifica in NAZIONALE (es. Pandur ha dnpZeroCount >= 1 e starterCount === 0 in Nazionale -> riserva in Nazionale!)
        let natFitnessTier = 'rotation';
        if (isInjuredOrSuspended) {
          natFitnessTier = 'last_resort';
        } else if (natStats.totalEntries > 0) {
          if (natStats.starterCount >= 2 || (natStats.starterCount >= 1 && natStats.dnpZeroCount === 0 && natStats.avgMins >= 65)) {
            natFitnessTier = 'starter';
          } else if (natStats.playedCount === 0 && natStats.dnpZeroCount > 0) {
            // Convocato in Nazionale ma tenuto in panchina (0 pt) -> Riserva / Non titolare in Nazionale
            natFitnessTier = 'bench_nat';
          } else {
            natFitnessTier = 'rotation';
          }
        } else {
          // Se non ha storico recente in Nazionale, solo i top player (L15 >= 52) vengono considerati potenziali titolari, i portieri di club minori vengono considerati riserve in Nazionale
          natFitnessTier = (pos === 'GK' && l15 < 50) ? 'bench_nat' : (clubFitnessTier === 'starter' && l15 >= 48 ? 'starter' : 'rotation');
        }

        let baseUnavailableReason = '';
        if (isInjured) baseUnavailableReason = 'Infortunato (Ufficiale Sorare)';
        else if (isSuspended) baseUnavailableReason = 'Squalificato (Ufficiale Sorare)';

        const isAerialDominator = pos === 'DEF' && clubStats.playedCount > 0 && (clubStats.goals >= 1 || clubStats.avgAas >= 20);
        const isDefensiveWall = pos === 'DEF' && clubStats.playedCount > 0 && clubStats.avgAas >= 22;
        const isPlaymakerCreator = pos === 'MID' && clubStats.playedCount > 0 && (clubStats.avgAas >= 24 || clubStats.assists >= 1);
        const isBoxToBoxEngine = pos === 'MID' && clubStats.playedCount > 0 && clubStats.avgAas >= 19 && clubStats.avgMins >= 75;
        const isClinicalFinisher = (pos === 'FWD' || pos === 'MID') && clubStats.playedCount > 0 && ((clubStats.goals + clubStats.assists) >= 2 || clubStats.avgDecisive >= 25);
        const isTargetPenaltyBox = pos === 'FWD' && clubStats.playedCount > 0 && (clubStats.goals >= 1 || clubStats.maxScore >= 68);
        const isShotStopper = pos === 'GK' && clubStats.playedCount > 0 && (clubStats.saves >= 10 || clubStats.avgAas >= 12);

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
          avgAas: clubStats.avgAas,
          avgDecisive: clubStats.avgDecisive,
          maxRecentScore: clubStats.maxScore,
          minRecentScore: clubStats.minScore,
          stdDev: clubStats.stdDev,
          playedCount: clubStats.playedCount,
          starterCount: clubStats.starterCount,
          avgMins: clubStats.avgMins,
          clubStats: clubStats,
          natStats: natStats,
          baseFitnessTier: clubFitnessTier,
          natFitnessTier: natFitnessTier,
          baseUnavailableReason: baseUnavailableReason,
          tacticalTraits: {
            aerialDominator: isAerialDominator,
            defensiveWall: isDefensiveWall,
            playmakerCreator: isPlaymakerCreator,
            boxToBoxEngine: isBoxToBoxEngine,
            clinicalFinisher: isClinicalFinisher,
            targetPenaltyBox: isTargetPenaltyBox,
            shotStopper: isShotStopper,
            cleanSheets: clubStats.cleanSheets,
            goals: clubStats.goals,
            assists: clubStats.assists,
            saves: clubStats.saves
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
