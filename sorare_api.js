// SorareHub - Real GraphQL Opta/SO5, UEFA & Fixture Layer
const SorareAPI = {
  generateRandomString(length = 32) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, v => charset[v % charset.length]).join('');
  },

  async startOAuthFlow() {
    if (localStorage.getItem('sorare_access_token')) {
      if (window.App && App.loadUserGallery) {
        App.loadUserGallery();
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
      alert('Errore durante il login Sorare: ' + err.message);
      return null;
    }
  },

  async fetchCurrentUserGallery() {
    const token = localStorage.getItem('sorare_access_token');
    if (!token) return null;

    const workerGraphqlEndpoint = `${CONFIG.TOKEN_ENDPOINT.replace(/\/$/, '')}/graphql`;

    const pagedQuery = `
      query GetCurrentUserCards($after: String) {
        currentUser {
          slug
          nickname
          cards(first: 40, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              slug
              name
              rarityTyped
              seasonYear
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
                    expectedEndDate
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
                      penaltiesSaved
                    }
                  }
                  activeClub {
                    name
                    slug
                    domesticLeague {
                      slug
                      displayName
                    }
                    upcomingGames(first: 3) {
                      date
                      competition {
                        slug
                        displayName
                      }
                      homeTeam {
                        ... on Club {
                          slug
                          name
                        }
                      }
                      awayTeam {
                        ... on Club {
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

    while (hasNext && batchIndex < 35) {
      batchIndex++;

      const res = await fetch(workerGraphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: pagedQuery,
          variables: { after: cursor }
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        if (res.status === 401) {
          localStorage.removeItem('sorare_access_token');
        }
        throw new Error(`Errore API Sorare (${res.status}): ${errBody}`);
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

      allCards = allCards.concat(nodes);

      const loginBtnText = document.getElementById('login-btn-text');
      if (loginBtnText) {
        loginBtnText.textContent = `📥 Caricate ${allCards.length} carte...`;
      }
      if (window.App && App.notify) {
        App.notify(`📥 Analisi Opta: ${allCards.length} carte...`);
      }

      const pageInfo = connection?.pageInfo;
      hasNext = Boolean(pageInfo?.hasNextPage) && Boolean(pageInfo?.endCursor);
      cursor = pageInfo?.endCursor || null;

      if (!hasNext || !cursor) break;

      await new Promise(resolve => setTimeout(resolve, 150));
    }

    return {
      user: userProfile,
      cards: this.enrichCardsWithRealOptaData(allCards)
    };
  },

  enrichCardsWithRealOptaData(rawCards) {
    const now = Date.now();
    // Finestra 24 giorni per includere anche i campionati fermi per la sosta nazionali FIFA
    const scheduleWindowMs = 24 * 24 * 60 * 60 * 1000;
    const uefaWindowMs = 21 * 24 * 60 * 60 * 1000;

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

        const upcomingList = Array.isArray(club.upcomingGames) ? club.upcomingGames : [];
        const upcomingNode = upcomingList[0] || null;

        // Controllo UEFA rigoroso: solo partite effettivamente in calendario nella fase principale UEFA
        const validUefaGames = upcomingList.filter(g => {
          if (!g || !g.date) return false;
          const t = new Date(g.date).getTime();
          return !Number.isNaN(t) && (t - now) <= uefaWindowMs;
        });

        const isUefaChampions = validUefaGames.some(g => {
          const cSlug = String(g.competition?.slug || '').toLowerCase();
          return (cSlug === 'uefa-champions-league' || (cSlug.includes('champions-league') && !cSlug.includes('qualif')));
        });

        const isUefaContender = validUefaGames.some(g => {
          const cSlug = String(g.competition?.slug || '').toLowerCase();
          return (
            cSlug === 'uefa-europa-league' ||
            cSlug === 'uefa-conference-league' ||
            cSlug === 'uefa-europa-conference-league' ||
            ((cSlug.includes('europa-league') || cSlug.includes('conference-league')) && !cSlug.includes('qualif'))
          );
        });

        const sYear = Number(card.seasonYear || 0);
        const isInSeason = sYear >= 2026;

        const birthTime = player.birthDate ? new Date(player.birthDate).getTime() : 0;
        const u23Cutoff = new Date('2003-07-01').getTime();
        const isU23 = birthTime > 0 ? birthTime >= u23Cutoff : false;

        // Analisi reale delle partite SO5 (esclude i DNP come fa il sito ufficiale Sorare)
        const allRecentScores = Array.isArray(player.so5Scores) ? player.so5Scores : [];
        const last5Window = allRecentScores.slice(0, 5);
        const playedMatchesAll = allRecentScores.filter(s => {
          if (!s) return false;
          const sc = typeof s.score === 'number' ? s.score : 0;
          const mins = typeof s.playerGameStats?.minsPlayed === 'number' ? s.playerGameStats.minsPlayed : 0;
          return sc > 0 || mins > 0;
        });

        const last5Played = playedMatchesAll.slice(0, 5);

        // Calcolo L5 ufficiale Sorare (media delle ultime 5 partite GIOCATE, escludendo DNP)
        const apiL5 = typeof player.l5 === 'number' ? Number(player.l5.toFixed(1)) : 0;
        const computedL5 = last5Played.length > 0
          ? Number((last5Played.reduce((acc, m) => acc + (m.score || 0), 0) / last5Played.length).toFixed(1))
          : 0;
        const l5 = computedL5 > 0 ? computedL5 : apiL5;

        // Calcolo L15 ufficiale Sorare (esclude DNP se il valore GraphQL include zeri)
        const apiL15 = typeof player.l15 === 'number' ? Number(player.l15.toFixed(1)) : 0;
        const computedL10 = playedMatchesAll.length > 0
          ? Number((playedMatchesAll.reduce((acc, m) => acc + (m.score || 0), 0) / playedMatchesAll.length).toFixed(1))
          : 0;
        const l15 = apiL15 > 0 ? Math.max(apiL15, Number(((apiL15 + computedL10) / 2).toFixed(1))) : computedL10;

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

        let hasUpcomingGame = false;
        let isHome = null;
        let opponentName = 'Sosta Nazionali / Prossimo turno';
        let opponentSlug = '';
        let gameDate = null;

        if (upcomingNode && upcomingNode.date) {
          const gTime = new Date(upcomingNode.date).getTime();
          if (!Number.isNaN(gTime) && (gTime - now) <= scheduleWindowMs) {
            hasUpcomingGame = true;
            gameDate = upcomingNode.date;
            if (upcomingNode.homeTeam?.slug === clubSlug) {
              isHome = true;
              opponentName = upcomingNode.awayTeam?.name || 'Avversario';
              opponentSlug = upcomingNode.awayTeam?.slug || '';
            } else {
              isHome = false;
              opponentName = upcomingNode.homeTeam?.name || 'Avversario';
              opponentSlug = upcomingNode.homeTeam?.slug || '';
            }
          }
        }

        // Classificazione titolarità basata sulle presenze reali recenti
        let availabilityTier = 'last_resort';
        let unavailableReason = '';

        if (isInjured) {
          unavailableReason = 'Infortunato (segnalato su Sorare)';
        } else if (isSuspended) {
          unavailableReason = 'Squalificato';
        } else if (!club.slug) {
          unavailableReason = 'Senza club attivo';
        } else if (l5 <= 0 && playedInLast5Games === 0) {
          unavailableReason = 'Nessuna presenza nelle ultime 5 partite';
        } else if (starterCount >= 3 || (playedInLast5Games >= 3 && avgMins >= 60)) {
          availabilityTier = 'starter';
        } else if (playedInLast5Games >= 1 && l5 > 0) {
          availabilityTier = 'rotation';
        } else {
          unavailableReason = 'Inattivo / fuori dalle rotazioni recenti';
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
          isUefaChampions: isUefaChampions,
          isUefaContender: isUefaContender,
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
          availabilityTier: availabilityTier,
          confirmedXi: availabilityTier === 'starter',
          isLastResort: availabilityTier === 'last_resort',
          unavailableReason: unavailableReason,
          hasUpcomingGame: hasUpcomingGame,
          isHome: isHome,
          opponentName: opponentName,
          opponentSlug: opponentSlug,
          gameDate: gameDate,
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
