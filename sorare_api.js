// SorareHub - True Sorare Scoring Math (Base 35 + Net Decisive + True AA) & Full Role Opta Stats
const SorareAPI = {
  CACHE_KEY: 'sorarehub_gallery_cache_v23',
  FALLBACK_CACHE_KEYS: ['sorarehub_gallery_cache_v23', 'sorarehub_gallery_cache_v22', 'sorarehub_gallery_cache_v21'],
  CACHE_TTL_MS: 12 * 60 * 1000,

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
      try {
        const res = await fetch(url, options);
        if (res.status !== 429 && res.status < 500) {
          return res;
        }
        if (attempt < maxRetries) {
          const waitMs = 2200 * (attempt + 1);
          if (window.App && App.notify) {
            App.notify(`⏳ Sorare occupato (${res.status}): riprovo tra ${Math.round(waitMs / 1000)}s...`);
          }
          await new Promise(resolve => setTimeout(resolve, waitMs));
        } else {
          return res;
        }
      } catch (networkErr) {
        if (attempt < maxRetries) {
          const waitMs = 2000 * (attempt + 1);
          if (window.App && App.notify) {
            App.notify(`⏳ Riconnessione al proxy Sorare in corso (tentativo ${attempt + 1}/${maxRetries})...`);
          }
          await new Promise(resolve => setTimeout(resolve, waitMs));
        } else {
          throw networkErr;
        }
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
      const dayOfWeek = d.getUTCDay();
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

  loadAnyAvailableCache(ignoreTtl = false) {
    for (const key of this.FALLBACK_CACHE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
          if (ignoreTtl || ((Date.now() - (parsed.timestamp || 0)) < this.CACHE_TTL_MS)) {
            return parsed;
          }
        }
      } catch (_) {}
    }
    return null;
  },

  async fetchCurrentUserGallery(forceRefresh = false) {
    const token = localStorage.getItem('sorare_access_token');
    if (!token) return null;

    if (!forceRefresh) {
      const cached = this.loadAnyAvailableCache(false);
      if (cached) {
        return {
          user: cached.user,
          gameweeks: this.buildOfficialSorareGameweeks(),
          cards: cached.cards
        };
      }
    }

    const baseWorkerUrl = String(CONFIG.TOKEN_ENDPOINT || 'https://sorarehub-oauth.matty-ciaroni.workers.dev').replace(/\/$/, '');
    const workerGraphqlEndpoint = baseWorkerUrl.endsWith('/graphql') ? baseWorkerUrl : `${baseWorkerUrl}/graphql`;

    const pagedQuery = `
      query GetCurrentUserCards($after: String) {
        currentUser {
          slug
          nickname
          cards(first: 30, after: $after, rarities: [limited, rare, super_rare, unique]) {
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
                  so5Scores(last: 6) {
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
                      accuratePass
                      ontargetScoringAtt
                      wonTackle
                      interceptionWon
                      effectiveClearance
                      duelWon
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
                    upcomingGames(first: 3) {
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

    try {
      while (hasNext && batchIndex < 25) {
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
          App.notify(`📥 Analisi Opta & Profili Tattici: ${allCards.length} carte Pro...`);
        }

        const pageInfo = connection?.pageInfo;
        hasNext = Boolean(pageInfo?.hasNextPage) && Boolean(pageInfo?.endCursor);
        cursor = pageInfo?.endCursor || null;

        if (!hasNext || !cursor) break;

        await new Promise(resolve => setTimeout(resolve, 350));
      }
    } catch (fetchErr) {
      if (allCards.length === 0) {
        const fallbackCache = this.loadAnyAvailableCache(true);
        if (fallbackCache) {
          if (window.App && App.notify) {
            App.notify('⚠️ Proxy Sorare occupato: caricata galleria salvata in cache.');
          }
          return {
            user: fallbackCache.user,
            gameweeks: this.buildOfficialSorareGameweeks(),
            cards: fallbackCache.cards
          };
        }
        throw fetchErr;
      }
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
        const clubSlug = (club.slug || 'no-club').toLowerCase();
        const leagueSlug = (club.domesticLeague?.slug || 'other').toLowerCase();
        const leagueName = club.domesticLeague?.displayName || leagueSlug;

        const natTeam = player.activeNationalTeam || {};
        const natSlug = (natTeam.slug || '').toLowerCase();
        const natName = natTeam.name || '';

        const isGameNational = (g, isNatSource = false) => {
          if (isNatSource) return true;
          if (!g) return false;
          const homeSlug = (g.homeTeam?.slug || '').toLowerCase();
          const awaySlug = (g.awayTeam?.slug || '').toLowerCase();
          const compSlug = String(g.competition?.slug || '').toLowerCase();
          const matchesNatTeam = Boolean(natSlug && (homeSlug === natSlug || awaySlug === natSlug));
          const matchesClubTeam = Boolean(clubSlug && (homeSlug === clubSlug || awaySlug === clubSlug));
          const isCompNational = NATIONAL_COMP_KEYWORDS.some(k => compSlug.includes(k));
          return matchesNatTeam || (!matchesClubTeam && isCompNational);
        };

        const allRecentScores = Array.isArray(player.so5Scores) ? player.so5Scores : [];
        const clubScoreEntries = [];
        const natScoreEntries = [];
        const activeClubCompetitionsSet = new Set();
        if (leagueSlug && leagueSlug !== 'other') activeClubCompetitionsSet.add(leagueSlug);

        allRecentScores.forEach(s => {
          if (!s) return;
          const compSlug = String(s.game?.competition?.slug || '').toLowerCase();
          if (isGameNational(s.game, false)) {
            natScoreEntries.push(s);
          } else {
            clubScoreEntries.push(s);
            if (compSlug) activeClubCompetitionsSet.add(compSlug);
          }
        });

        (Array.isArray(club.upcomingGames) ? club.upcomingGames : []).forEach(g => {
          const compSlug = String(g?.competition?.slug || '').toLowerCase();
          if (compSlug) activeClubCompetitionsSet.add(compSlug);
        });

        // Calcola le VERE metriche Sorare:
        // Su Sorare decisiveScore.totalScore parte da 35 pt (se titolare) o 15 pt (se subentrato).
        // Quindi:
        // - All-Around Puro (AA) = score - decisiveScore.totalScore
        // - Punti Bonus Decisive Netti (oltre il voto base 35/15) = Math.max(0, decisiveScore.totalScore - baseAppearancePts)
        const computeSplitMetrics = (entries, maxWindow = 5) => {
          const slice = entries.slice(0, maxWindow);
          let totalEntries = slice.length;
          let playedCount = 0;
          let starterCount = 0;
          let dnpZeroCount = 0;
          let totalMins = 0;
          let sumScores = 0;
          let sumPureAas = 0;
          let sumNetDecisiveBonus = 0;
          let maxScore = 0;
          let minScore = 100;
          const validScores = [];
          const matchLogs = [];

          let goals = 0;
          let assists = 0;
          let cleanSheets = 0;
          let saves = 0;
          let totalAccuratePass = 0;
          let totalShotsOnTarget = 0;
          let totalDefActions = 0; // tackles + intercetti + spazzate
          let totalDuelsWon = 0;

          slice.forEach(s => {
            const sc = typeof s.score === 'number' ? Number(s.score.toFixed(1)) : 0;
            const stats = s.playerGameStats || {};
            const mins = typeof stats.minsPlayed === 'number' ? stats.minsPlayed : (sc > 0 ? 60 : 0);

            const rawDecisiveTotal = typeof s.decisiveScore?.totalScore === 'number'
              ? Number(s.decisiveScore.totalScore.toFixed(1))
              : (mins >= 55 ? 35 : (mins > 0 ? 15 : 0));

            // Voto di partenza Sorare: 35 pt per chi parte titolare, 15 pt per chi subentra
            const baseStartingPts = mins >= 45 ? 35 : (mins > 0 ? 15 : 0);
            // Bonus Decisive NETTO (es. +25 pt per 1 Gol/Assist/CleanSheet oltre i 35 base)
            const netDecisiveBonus = Math.max(0, Number((rawDecisiveTotal - baseStartingPts).toFixed(1)));
            // All-Around PURO (AA: passaggi, contrasti, tiri, parate, duelli)
            const pureAas = Number((sc - rawDecisiveTotal).toFixed(1));

            const g = s.game || {};
            const homeSlug = (g.homeTeam?.slug || '').toLowerCase();
            const homeName = g.homeTeam?.name || 'Casa';
            const awayName = g.awayTeam?.name || 'Trasferta';
            const isNat = isGameNational(g, false);
            const refSlug = isNat ? natSlug : clubSlug;
            const isHome = refSlug ? (homeSlug === refSlug) : true;
            const oppName = isHome ? awayName : homeName;

            const gGoals = stats.goals || 0;
            const gAssists = stats.goalAssist || 0;
            const gCs = stats.cleanSheet || 0;
            const gSaves = stats.saves || 0;
            const gPass = stats.accuratePass || 0;
            const gSot = stats.ontargetScoringAtt || 0;
            const gDef = (stats.wonTackle || 0) + (stats.interceptionWon || 0) + (stats.effectiveClearance || 0);
            const gDuels = stats.duelWon || 0;

            if (mins > 0 || sc > 0) {
              playedCount++;
              totalMins += mins;
              if (mins >= 55) starterCount++;
              sumScores += sc;
              validScores.push(sc);
              if (sc > maxScore) maxScore = sc;
              if (sc < minScore) minScore = sc;

              sumPureAas += pureAas;
              sumNetDecisiveBonus += netDecisiveBonus;

              goals += gGoals;
              assists += gAssists;
              cleanSheets += gCs;
              saves += gSaves;
              totalAccuratePass += gPass;
              totalShotsOnTarget += gSot;
              totalDefActions += gDef;
              totalDuelsWon += gDuels;

              matchLogs.push({
                opponent: oppName,
                isNational: isNat,
                isHome: isHome,
                score: Math.round(sc),
                exactScore: sc,
                aas: pureAas,
                netDecisive: netDecisiveBonus,
                mins: mins,
                goals: gGoals,
                assists: gAssists,
                cleanSheet: gCs,
                saves: gSaves,
                passes: gPass,
                defActions: gDef,
                duelsWon: gDuels,
                shotsOnTarget: gSot
              });
            } else {
              dnpZeroCount++;
            }
          });

          if (validScores.length === 0) minScore = 0;
          const avgScore = playedCount > 0 ? Number((sumScores / playedCount).toFixed(1)) : 0;
          const avgMins = playedCount > 0 ? Math.round(totalMins / playedCount) : 0;
          const avgAas = playedCount > 0 ? Number((sumPureAas / playedCount).toFixed(1)) : 0;
          const avgNetDecisive = playedCount > 0 ? Number((sumNetDecisiveBonus / playedCount).toFixed(1)) : 0;

          const avgPasses = playedCount > 0 ? Math.round(totalAccuratePass / playedCount) : 0;
          const avgDefActions = playedCount > 0 ? Number((totalDefActions / playedCount).toFixed(1)) : 0;
          const avgDuelsWon = playedCount > 0 ? Number((totalDuelsWon / playedCount).toFixed(1)) : 0;
          const avgShotsOnTarget = playedCount > 0 ? Number((totalShotsOnTarget / playedCount).toFixed(1)) : 0;

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
            avgDecisive: avgNetDecisive,
            maxScore: Math.round(maxScore),
            minScore: Math.round(minScore),
            stdDev,
            goals,
            assists,
            cleanSheets,
            saves,
            avgPasses,
            avgDefActions,
            avgDuelsWon,
            avgShotsOnTarget,
            matchLogs
          };
        };

        // 1) Statistiche complessive sulle ultime 6 gare (Club + Nazionale) per avere SEMPRE 5-6 partite reali nel dossier!
        const combinedStats = computeSplitMetrics(allRecentScores, 6);
        // 2) Statistiche solo Club e solo Nazionale per verificare titolarità e convocazioni
        const clubStats = computeSplitMetrics(clubScoreEntries.length > 0 ? clubScoreEntries : allRecentScores, 5);
        const natStats = computeSplitMetrics(natScoreEntries, 6);

        const isNationalCallupVerified = natStats.playedCount >= 1;

        const scheduleGames = [];
        const seenGameKeys = new Set();

        const pushUniqueGame = (g, isNatSource, alreadyPlayedScore = null, alreadyPlayedMins = null) => {
          if (!g || !g.date) return;
          const ts = new Date(g.date).getTime();
          if (!ts || Number.isNaN(ts)) return;

          const homeSlug = (g.homeTeam?.slug || '').toLowerCase();
          const awaySlug = (g.awayTeam?.slug || '').toLowerCase();
          const homeName = g.homeTeam?.name || 'Casa';
          const awayName = g.awayTeam?.name || 'Trasferta';
          const compSlug = String(g.competition?.slug || '').toLowerCase();
          const compName = g.competition?.displayName || g.competition?.slug || 'Match';

          const dayKey = new Date(ts).toISOString().slice(0, 10);
          const dedupKey = `${dayKey}_${homeSlug || homeName}_${awaySlug || awayName}`;
          if (seenGameKeys.has(dedupKey)) return;

          const isNationalMatch = isGameNational(g, isNatSource);

          if (isNationalMatch && alreadyPlayedScore === null && !isNationalCallupVerified) {
            return;
          }

          seenGameKeys.add(dedupKey);

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
              competitionSlug: compSlug || leagueSlug,
              competitionName: compName || leagueName,
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

        allRecentScores.forEach(s => {
          if (s && s.game && s.game.date) {
            const sc = typeof s.score === 'number' ? Number(s.score.toFixed(1)) : 0;
            const mins = typeof s.playerGameStats?.minsPlayed === 'number' ? s.playerGameStats.minsPlayed : 0;
            pushUniqueGame(s.game, false, sc, mins);
          }
        });

        (Array.isArray(club.upcomingGames) ? club.upcomingGames : []).forEach(g => pushUniqueGame(g, false, null, null));
        if (isNationalCallupVerified) {
          (Array.isArray(natTeam.upcomingGames) ? natTeam.upcomingGames : []).forEach(g => pushUniqueGame(g, true, null, null));
        }

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

        const apiL5 = typeof player.l5 === 'number' ? Number(player.l5.toFixed(1)) : 0;
        const l5 = combinedStats.avgScore > 0 ? combinedStats.avgScore : apiL5;
        const apiL15 = typeof player.l15 === 'number' ? Number(player.l15.toFixed(1)) : 0;
        const l15 = apiL15 > 0 ? apiL15 : l5;

        const injuries = Array.isArray(player.activeInjuries) ? player.activeInjuries : [];
        const suspensions = Array.isArray(player.activeSuspensions) ? player.activeSuspensions : [];
        const isInjured = injuries.length > 0;
        const isSuspended = suspensions.length > 0;
        const isInjuredOrSuspended = isInjured || isSuspended;

        let clubFitnessTier = 'last_resort';
        if (!isInjuredOrSuspended) {
          if (clubStats.starterCount >= 3 || (clubStats.playedCount >= 3 && clubStats.avgMins >= 62)) {
            clubFitnessTier = 'starter';
          } else if (clubStats.playedCount >= 1 || l5 > 0) {
            clubFitnessTier = 'rotation';
          }
        }

        let natFitnessTier = 'bench_nat';
        if (!isInjuredOrSuspended && isNationalCallupVerified) {
          if (natStats.starterCount >= 2 || (natStats.starterCount >= 1 && natStats.dnpZeroCount === 0 && natStats.avgMins >= 60)) {
            natFitnessTier = 'starter';
          } else if (natStats.playedCount >= 1) {
            natFitnessTier = 'rotation';
          }
        }

        let baseUnavailableReason = '';
        if (isInjured) baseUnavailableReason = 'Infortunato (Ufficiale Sorare)';
        else if (isSuspended) baseUnavailableReason = 'Squalificato (Ufficiale Sorare)';

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
          activeClubCompetitions: Array.from(activeClubCompetitionsSet),
          isNationalCallupVerified: isNationalCallupVerified,
          scheduleGames: scheduleGames,
          position: pos,
          scarcity: (card.rarityTyped || 'limited').toLowerCase(),
          seasonYear: sYear,
          isInSeason: isInSeason,
          isU23: isU23,
          isInjuredOrSuspended: isInjuredOrSuspended,
          l5: l5,
          l15: l15,
          avgAas: combinedStats.avgAas,
          avgDecisive: combinedStats.avgDecisive,
          maxRecentScore: combinedStats.maxScore,
          minRecentScore: combinedStats.minScore,
          stdDev: combinedStats.stdDev,
          playedCount: combinedStats.playedCount,
          starterCount: combinedStats.starterCount,
          avgMins: combinedStats.avgMins,
          combinedStats: combinedStats,
          clubStats: clubStats,
          natStats: natStats,
          baseFitnessTier: clubFitnessTier,
          natFitnessTier: natFitnessTier,
          baseUnavailableReason: baseUnavailableReason,
          tacticalTraits: {
            cleanSheets: combinedStats.cleanSheets,
            goals: combinedStats.goals,
            assists: combinedStats.assists,
            saves: combinedStats.saves,
            avgPasses: combinedStats.avgPasses,
            avgDefActions: combinedStats.avgDefActions,
            avgDuelsWon: combinedStats.avgDuelsWon,
            avgShotsOnTarget: combinedStats.avgShotsOnTarget
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
