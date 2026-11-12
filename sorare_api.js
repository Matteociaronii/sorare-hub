// SorareHub - Real GraphQL Opta/SO5 & Fixture Layer
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
                      accuratePass
                      wonTackle
                      interceptionWon
                      ontargetScoringAtt
                      bigChanceCreated
                      keyPass
                      penaltiesSaved
                      saves
                    }
                  }
                  activeClub {
                    name
                    slug
                    domesticLeague {
                      slug
                      displayName
                    }
                    upcomingGames(first: 1) {
                      nodes {
                        date
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
    const currentSeason = 2026;
    const now = Date.now();
    const tenDaysMs = 10 * 24 * 60 * 60 * 1000;

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
        const leagueSlug = club.domesticLeague?.slug || 'other';

        const isInSeason = (card.seasonYear || 0) >= currentSeason;
        const birthYear = player.birthDate ? new Date(player.birthDate).getFullYear() : 2000;
        const isU23 = birthYear >= 2003;

        // Medie reali L5 & L15
        const l5 = typeof player.l5 === 'number' ? Number(player.l5.toFixed(1)) : 0;
        const l15 = typeof player.l15 === 'number' ? Number(player.l15.toFixed(1)) : 0;

        // Analisi reale delle ultime 5 partite SO5
        const recentScores = Array.isArray(player.so5Scores) ? player.so5Scores : [];
        let playedCount = 0;
        let starterCount = 0;
        let totalMins = 0;
        let sumAas = 0;
        let sumDecisive = 0;
        let maxRecentScore = 0;
        let validScoreValues = [];

        // Metriche Opta reali aggregate
        let totalKeyPasses = 0;
        let totalBigChances = 0;
        let totalShotsOnTarget = 0;
        let totalTacklesInterceptions = 0;
        let totalGoals = 0;
        let totalAssists = 0;
        let totalCleanSheets = 0;

        recentScores.forEach(s => {
          if (!s) return;
          const sc = typeof s.score === 'number' ? s.score : 0;
          const stats = s.playerGameStats || {};
          const mins = typeof stats.minsPlayed === 'number' ? stats.minsPlayed : (sc > 0 ? 60 : 0);

          if (mins > 0 || sc > 0) {
            playedCount++;
            totalMins += mins;
            if (mins >= 55) starterCount++;
            validScoreValues.push(sc);
            if (sc > maxRecentScore) maxRecentScore = sc;

            const dec = typeof s.decisiveScore?.totalScore === 'number' ? s.decisiveScore.totalScore : 0;
            const aas = Math.max(0, Number((sc - dec).toFixed(1)));
            sumAas += aas;
            sumDecisive += dec;

            totalKeyPasses += stats.keyPass || 0;
            totalBigChances += stats.bigChanceCreated || 0;
            totalShotsOnTarget += stats.ontargetScoringAtt || 0;
            totalTacklesInterceptions += (stats.wonTackle || 0) + (stats.interceptionWon || 0);
            totalGoals += stats.goals || 0;
            totalAssists += stats.goalAssist || 0;
            totalCleanSheets += stats.cleanSheet || 0;
          }
        });

        const avgMins = playedCount > 0 ? Math.round(totalMins / playedCount) : 0;
        const avgAas = playedCount > 0 ? Number((sumAas / playedCount).toFixed(1)) : 0;
        const avgDecisive = playedCount > 0 ? Number((sumDecisive / playedCount).toFixed(1)) : 0;

        // Deviazione standard reale sulle ultime 5 partite
        let stdDev = 0;
        if (validScoreValues.length > 1) {
          const mean = validScoreValues.reduce((a, b) => a + b, 0) / validScoreValues.length;
          const variance = validScoreValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / validScoreValues.length;
          stdDev = Number(Math.sqrt(variance).toFixed(1));
        }

        // Controllo infortuni / squalifiche reali
        const injuries = Array.isArray(player.activeInjuries) ? player.activeInjuries : [];
        const suspensions = Array.isArray(player.activeSuspensions) ? player.activeSuspensions : [];
        const isInjured = injuries.length > 0;
        const isSuspended = suspensions.length > 0;

        // Controllo prossima partita della Gameweek
        const upcomingNode = club.upcomingGames?.nodes?.[0] || null;
        let hasUpcomingGame = false;
        let isHome = null;
        let opponentName = 'Nessuna partita in GW';
        let opponentSlug = '';
        let gameDate = null;

        if (upcomingNode && upcomingNode.date) {
          const gTime = new Date(upcomingNode.date).getTime();
          if (!Number.isNaN(gTime) && (gTime - now) <= tenDaysMs) {
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

        // Classificazione reale titolarità
        let availabilityTier = 'last_resort';
        let unavailableReason = '';

        if (isInjured) {
          unavailableReason = 'Infortunato (segnalato su Sorare)';
        } else if (isSuspended) {
          unavailableReason = 'Squalificato';
        } else if (!club.slug) {
          unavailableReason = 'Senza club attivo';
        } else if (!hasUpcomingGame) {
          unavailableReason = 'Nessuna partita in programma in questa Gameweek';
        } else if (l5 <= 0 && playedCount === 0) {
          unavailableReason = 'Nessuna presenza nelle ultime 5 partite (L5: 0)';
        } else if (starterCount >= 3 || (playedCount >= 4 && avgMins >= 55)) {
          availabilityTier = 'starter';
        } else if (playedCount >= 1 && l5 > 0) {
          availabilityTier = 'rotation';
        } else {
          unavailableReason = 'Inattivo / fuori dalle rotazioni recenti';
        }

        // Rilevamento specialità tattiche Opta reali
        const isSetPieceTaker = pos !== 'GK' && playedCount > 0 && ((totalKeyPasses + totalBigChances) / playedCount >= 1.4);
        const isAerialThreat = (pos === 'DEF' || pos === 'FWD') && playedCount > 0 && (avgAas >= 24 && (pos === 'DEF' || totalShotsOnTarget / playedCount >= 0.8));
        const isBallWinner = (pos === 'DEF' || pos === 'MID') && playedCount > 0 && (totalTacklesInterceptions / playedCount >= 2.8);
        const isClinicalFinisher = (pos === 'FWD' || pos === 'MID') && playedCount > 0 && ((totalGoals + totalAssists) >= 2 || totalShotsOnTarget / playedCount >= 1.2);

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
          position: pos,
          scarcity: (card.rarityTyped || 'limited').toLowerCase(),
          seasonYear: card.seasonYear || currentSeason,
          isInSeason: isInSeason,
          isU23: isU23,
          l5: l5,
          l15: l15,
          avgAas: avgAas,
          avgDecisive: avgDecisive,
          maxRecentScore: Math.round(maxRecentScore),
          stdDev: stdDev,
          playedCount: playedCount,
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
            assists: totalAssists
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
