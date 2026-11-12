// SorareHub - TeamInterface National Team + Club Schedule & 2026/27 In-Season Detection
const SorareAPI = {
  CACHE_KEY: 'sorarehub_gallery_cache_v13',
  CACHE_TTL_MS: 15 * 60 * 1000, // 15 minuti

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

  buildGameweekWindowsFromCards(cards) {
    const nowMs = Date.now() - 6 * 3600 * 1000;
    const allTimestamps = [];

    (cards || []).forEach(c => {
      (c.scheduleGames || []).forEach(g => {
        if (g.timestamp && g.timestamp >= nowMs) {
          allTimestamps.push(g.timestamp);
        }
      });
    });

    allTimestamps.sort((a, b) => a - b);

    if (allTimestamps.length > 0) {
      const clusters = [];
      let currentClusterStart = allTimestamps[0];
      let currentClusterEnd = allTimestamps[0];

      for (let i = 1; i < allTimestamps.length; i++) {
        const ts = allTimestamps[i];
        if (ts - currentClusterEnd > 48 * 3600 * 1000 && ts - currentClusterStart > 3.5 * 24 * 3600 * 1000) {
          clusters.push({ start: currentClusterStart, end: currentClusterEnd });
          currentClusterStart = ts;
          currentClusterEnd = ts;
        } else {
          currentClusterEnd = ts;
        }
      }
      clusters.push({ start: currentClusterStart, end: currentClusterEnd });

      return clusters.slice(0, 3).map((cl, idx) => {
        const startIso = new Date(cl.start - 6 * 3600 * 1000).toISOString();
        const endIso = new Date(cl.end + 12 * 3600 * 1000).toISOString();
        const label = idx === 0 ? 'Prossima GW (Attiva)' : (idx === 1 ? 'GW +1' : 'GW +2');
        return {
          index: idx,
          gameWeek: idx + 1,
          label: label,
          startDate: startIso,
          endDate: endIso,
          dateRangeText: this.formatDateRange(startIso, endIso)
        };
      });
    }

    const start = new Date();
    const end = new Date(start.getTime() + 5 * 24 * 3600 * 1000);
    return [{
      index: 0,
      gameWeek: 1,
      label: 'GW Attuale',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dateRangeText: this.formatDateRange(start, end)
    }];
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
              gameweeks: cached.gameweeks,
              cards: cached.cards
            };
          }
        }
      } catch (_) {}
    }

    const workerGraphqlEndpoint = `${CONFIG.TOKEN_ENDPOINT.replace(/\/$/, '')}/graphql`;

    // Usa ... on TeamInterface per catturare sia Club che NationalTeam senza nodi vuoti
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
                  }
                  activeClub {
                    name
                    slug
                    domesticLeague {
                      slug
                    }
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

    const gameweeks = this.buildGameweekWindowsFromCards(enriched);

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

    return (rawCards || [])
      .filter(c => c && (c.name || c.player?.displayName))
      .map((card, index) => {
        const player = card.player || {};
        const playerName = player.displayName || card.name || 'Calciatore';
        const playerSlug = player.slug || card.slug || `slug_${index}`;
        const rawPos = (card.anyPositions && card.anyPositions[0]) || 'FORWARD';
        const pos = this.normalizePosition(rawPos);

        const club = player.activeClub || {};
        const clubName = club.name || 'Svincolato / N.D.';
        const clubSlug = club.slug || 'no-club';
        const leagueSlug = (club.domesticLeague?.slug || 'other').toLowerCase();

        const natTeam = player.activeNationalTeam || {};
        const natSlug = natTeam.slug || '';
        const natName = natTeam.name || '';

        const scheduleGames = [];

        const clubGames = Array.isArray(club.upcomingGames) ? club.upcomingGames : [];
        clubGames.forEach(g => {
          if (!g || !g.date) return;
          const isHome = g.homeTeam?.slug === clubSlug;
          scheduleGames.push({
            date: g.date,
            timestamp: new Date(g.date).getTime(),
            competitionSlug: String(g.competition?.slug || '').toLowerCase(),
            competitionName: g.competition?.displayName || g.competition?.slug || 'Club',
            isHome: isHome,
            opponentName: isHome ? (g.awayTeam?.name || 'Avversario') : (g.homeTeam?.name || 'Avversario'),
            opponentSlug: isHome ? (g.awayTeam?.slug || '') : (g.homeTeam?.slug || ''),
            isNationalTeam: false,
            teamName: clubName
          });
        });

        const natGames = Array.isArray(natTeam.upcomingGames) ? natTeam.upcomingGames : [];
        natGames.forEach(g => {
          if (!g || !g.date) return;
          const isHome = g.homeTeam?.slug === natSlug;
          const oppName = isHome ? (g.awayTeam?.name || 'Avversario Nazionale') : (g.homeTeam?.name || 'Avversario Nazionale');
          scheduleGames.push({
            date: g.date,
            timestamp: new Date(g.date).getTime(),
            competitionSlug: String(g.competition?.slug || 'international').toLowerCase(),
            competitionName: g.competition?.displayName || 'Nazionale',
            isHome: isHome,
            opponentName: oppName,
            opponentSlug: isHome ? (g.awayTeam?.slug || '') : (g.homeTeam?.slug || ''),
            isNationalTeam: true,
            teamName: `${natName || 'Nazionale'} vs ${oppName}`
          });
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

        const allRecentScores = Array.isArray(player.so5Scores) ? player.so5Scores : [];
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

        let baseFitnessTier = 'last_resort';
        let baseUnavailableReason = '';

        if (isInjured) {
          baseUnavailableReason = 'Infortunato (segnalato su Sorare)';
        } else if (isSuspended) {
          baseUnavailableReason = 'Squalificato';
        } else if (!club.slug && !natSlug) {
          baseUnavailableReason = 'Senza club/nazionale attiva';
        } else if (l5 <= 0 && playedInLast5Games === 0) {
          baseUnavailableReason = 'Nessuna presenza nelle ultime 5 partite';
        } else if (starterCount >= 3 || (playedInLast5Games >= 3 && avgMins >= 60)) {
          baseFitnessTier = 'starter';
        } else if (playedInLast5Games >= 1 && l5 > 0) {
          baseFitnessTier = 'rotation';
        } else {
          baseUnavailableReason = 'Inattivo / fuori dalle rotazioni recenti';
        }

        const isSetPieceTaker = pos !== 'GK' && playedInLast5Games > 0 && (avgAas >= 26 || totalAssists >= 2);
        const isAerialThreat = (pos === 'DEF' || pos === 'FWD') && playedInLast5Games > 0 && (avgAas >= 22);
        const isBallWinner = (pos === 'DEF' || pos === 'MID') && playedInLast5Games > 0 && (avgAas >= 23);
        const isClinicalFinisher = (pos === 'FWD' || pos === 'MID') && playedInLast5Games > 0 && ((totalGoals + totalAssists) >= 2 || avgDecisive >= 28);

        const rawPower = parseFloat(card.power) || (isInSeason ? 1.05 : 1.00);
        const totalBonusPct = Math.round((rawPower - 1) * 100);

        return {
          id: card.slug || `c_${index}`,
          playerSlug: playerSlug,
          name: playerName,
          pictureUrl: card.pictureUrl || player.pictureUrl || null,
          club: clubName,
          clubSlug: clubSlug,
          leagueSlug: leagueSlug,
          scheduleGames: scheduleGames,
          position: pos,
          scarcity: (card.rarityTyped || 'limited').toLowerCase(),
          seasonYear: sYear,
          isInSeason: isInSeason,
          isU23: isU23,
          l5: l5,
          l15: l15,
          avgAas: avgAas,
          avgDecisive: avgDecisive,
          maxRecentScore: Math.round(maxRecentScore),
          stdDev: stdDev,
          playedCount: playedInLast5Games,
          starterCount: starterCount,
          avgMins: avgMins,
          baseFitnessTier: baseFitnessTier,
          baseUnavailableReason: baseUnavailableReason,
          tacticalTraits: {
            setPiece: isSetPieceTaker,
            aerial: isAerialThreat,
            ballWinner: isBallWinner,
            clinical: isClinicalFinisher,
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
