// SorareHub - Dual Profile Engine + Official Sorare anyFutureGames(playerSlug) & PlayerGameStats (v39 Definitive)
const SorareAPI = {
  CACHE_KEY: 'sorarehub_gallery_cache_v39',
  FALLBACK_CACHE_KEYS: ['sorarehub_gallery_cache_v39', 'sorarehub_gallery_cache_v38', 'sorarehub_gallery_cache_v37', 'sorarehub_gallery_cache_v36', 'sorarehub_gallery_cache_v35'],
  CACHE_TTL_MS: 12 * 60 * 1000,
  lastBenchDiagnostic: null,
  cachedBenchSchemaInfo: null,

  // Lungodegenti noti / infortuni chirurgici non sempre segnalati in tempo reale dal feed Opta di Sorare
  KNOWN_LONG_TERM_INJURED_SLUGS: new Set([
    'mohamed-ali-zoma',
    'mohamed-zoma'
  ]),

  generateRandomString(length = 32) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, v => charset[v % charset.length]).join('');
  },

  extractCardUuidFromPictureUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return null;
    const match = urlStr.match(/\/card\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i);
    return match ? match[1].toLowerCase() : null;
  },

  extractPureUuid(rawIdStr) {
    if (!rawIdStr || typeof rawIdStr !== 'string') return null;
    const match = rawIdStr.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return match ? match[1].toLowerCase() : null;
  },

  getComposeBenchCardId(cardObj) {
    if (!cardObj) return null;
    if (cardObj.composeBenchId && cardObj.composeBenchId.startsWith('ComposeTeamBenchCard:')) {
      return cardObj.composeBenchId;
    }
    const uuid =
      this.extractPureUuid(cardObj.cardUuid) ||
      this.extractPureUuid(cardObj.assetId) ||
      this.extractCardUuidFromPictureUrl(cardObj.pictureUrl) ||
      this.extractCardUuidFromPictureUrl(cardObj.avatarUrl);

    return uuid ? `ComposeTeamBenchCard:${uuid}` : null;
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

  getWorkerGraphqlEndpoint() {
    const baseWorkerUrl = String(CONFIG.TOKEN_ENDPOINT || 'https://sorarehub-oauth.matty-ciaroni.workers.dev').replace(/\/$/, '');
    return baseWorkerUrl.endsWith('/graphql') ? baseWorkerUrl : `${baseWorkerUrl}/graphql`;
  },

  buildOfficialSorareGameweeks(officialGwNumber = null) {
    const nowMs = Date.now();
    let cursorMs = Date.UTC(2026, 10, 10, 15, 0, 0);
    let gwCounter = officialGwNumber || 729;

    for (let back = 0; back < 8; back++) {
      const prevDay = new Date(cursorMs).getUTCDay();
      const prevHours = (prevDay === 5) ? 72 : 96;
      cursorMs -= prevHours * 3600 * 1000;
      gwCounter--;
    }

    const boundaries = [];
    while (boundaries.length < 30 || cursorMs <= nowMs + (21 * 24 * 3600 * 1000)) {
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
      if (boundaries.length > 500) break;
    }

    let activeIdx = boundaries.findIndex(b => nowMs >= b.startMs && nowMs <= b.endMs);
    if (activeIdx === -1) {
      activeIdx = boundaries.findIndex(b => b.startMs >= nowMs);
      if (activeIdx === -1) activeIdx = Math.max(0, boundaries.length - 3);
    }

    return [0, 1, 2].map(offset => {
      const b = boundaries[activeIdx + offset] || boundaries[boundaries.length - 1];
      const startIso = new Date(b.startMs).toISOString();
      const endIso = new Date(b.endMs).toISOString();
      const isCurrentlyLive = nowMs >= b.startMs && nowMs <= b.endMs;
      const statusTag = offset === 0
        ? (isCurrentlyLive ? 'In Corso / Live' : 'Imminente')
        : (offset === 1 ? 'Prossima GW' : 'GW Successiva');
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

  loadAnyAvailableCache(ignoreTtl = false, allowedKeys = this.FALLBACK_CACHE_KEYS) {
    for (const key of allowedKeys) {
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

  percentageToSorareGrade(pct) {
    if (typeof pct !== 'number' || Number.isNaN(pct)) return null;
    if (pct >= 85) return 'A';
    if (pct >= 75) return 'B';
    if (pct >= 65) return 'C';
    if (pct >= 50) return 'D';
    if (pct >= 20) return 'E';
    return 'F';
  },

  sorareGradeToPercentage(grade) {
    const g = String(grade || '').toUpperCase().trim();
    const map = { 'A': 90, 'B': 75, 'C': 70, 'D': 60, 'E': 30, 'F': 0 };
    return map[g] !== undefined ? map[g] : null;
  },

  extractOddsAndStatusFromScoreNode(scoreNode) {
    if (!scoreNode) return null;

    const statsObj = scoreNode.anyPlayerGameStats || scoreNode.playerGameStats || null;
    const oddsObj = statsObj?.footballPlayingStatusOdds || null;
    const bp = oddsObj?.starterOddsBasisPoints;
    const reliability = oddsObj?.reliability || null;
    const fieldStatus = String(statsObj?.fieldStatus || '').toUpperCase().trim();
    const minsPlayed = typeof statsObj?.minsPlayed === 'number' ? statsObj.minsPlayed : null;
    const liveScore = typeof scoreNode.score === 'number' ? scoreNode.score : null;

    const rawGrade = scoreNode.projection?.grade
      ? String(scoreNode.projection.grade).toUpperCase().trim()
      : null;

    const projScore = typeof scoreNode.projectedScore === 'number' && scoreNode.projectedScore > 0
      ? scoreNode.projectedScore
      : (typeof scoreNode.projection?.projectedScore === 'number' ? scoreNode.projection.projectedScore : null);

    let pct = null;
    if (typeof bp === 'number' && !Number.isNaN(bp)) {
      pct = Math.max(0, Math.min(100, Math.round(bp / 100)));
    }

    let grade = /^[A-F]$/.test(rawGrade || '') ? rawGrade : null;
    if (pct !== null && !grade) {
      grade = this.percentageToSorareGrade(pct);
    } else if (grade && pct === null) {
      pct = this.sorareGradeToPercentage(grade);
    }

    let officialStatus = null;
    if (
      fieldStatus === 'STARTER' ||
      fieldStatus === 'STARTING' ||
      fieldStatus === 'ON_FIELD' ||
      fieldStatus === 'SUBSTITUTED' ||
      statsObj?.gameStarted === 1
    ) {
      officialStatus = 'starter';
      pct = 100;
      grade = 'A';
    } else if (fieldStatus === 'SUBSTITUTE' || fieldStatus === 'BENCH' || fieldStatus === 'ON_BENCH') {
      officialStatus = 'bench';
      pct = 0;
      grade = 'F';
    } else if (
      fieldStatus === 'NOT_IN_SQUAD' ||
      fieldStatus === 'NOT_ON_GAME_SHEET' ||
      fieldStatus === 'OUT' ||
      fieldStatus === 'INJURED' ||
      fieldStatus === 'SUSPENDED'
    ) {
      officialStatus = 'out';
      pct = 0;
      grade = 'F';
    }

    if (pct === null && grade === null && officialStatus === null && projScore === null) {
      return null;
    }

    return {
      pct,
      grade,
      officialStatus,
      fieldStatus: fieldStatus || 'UNKNOWN',
      reliability,
      officialProjectedScore: projScore,
      liveScore,
      liveMins: minsPlayed,
      source: 'sorare_official',
      updatedAt: Date.now()
    };
  },

  normalizeStartingOddsPayload(rawOddsObj) {
    if (rawOddsObj === null || rawOddsObj === undefined) return null;

    if (typeof rawOddsObj === 'number') {
      const pct = rawOddsObj <= 1 && rawOddsObj > 0 ? Math.round(rawOddsObj * 100) : Math.round(rawOddsObj);
      const clamped = Math.max(0, Math.min(100, pct));
      return {
        pct: clamped,
        grade: this.percentageToSorareGrade(clamped),
        officialStatus: null
      };
    }

    if (typeof rawOddsObj === 'string') {
      const clean = rawOddsObj.trim().toUpperCase();
      if (/^[A-F]$/.test(clean)) {
        return {
          pct: this.sorareGradeToPercentage(clean),
          grade: clean,
          officialStatus: null
        };
      }
      const numMatch = clean.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        const val = parseFloat(numMatch[1]);
        const pct = val <= 1 && val > 0 ? Math.round(val * 100) : Math.round(val);
        const clamped = Math.max(0, Math.min(100, pct));
        return {
          pct: clamped,
          grade: this.percentageToSorareGrade(clamped),
          officialStatus: null
        };
      }
    }

    if (typeof rawOddsObj === 'object') {
      const isOfficialStarter =
        rawOddsObj.officialStatus === 'starter' ||
        rawOddsObj.starter === true ||
        rawOddsObj.isStarter === true ||
        rawOddsObj.starting === true ||
        String(rawOddsObj.status || '').toLowerCase() === 'starter' ||
        String(rawOddsObj.lineupStatus || '').toLowerCase() === 'starting';

      const isOfficialBench =
        rawOddsObj.officialStatus === 'bench' ||
        rawOddsObj.starter === false ||
        rawOddsObj.onBench === true ||
        String(rawOddsObj.status || '').toLowerCase() === 'substitute' ||
        String(rawOddsObj.status || '').toLowerCase() === 'bench';

      let rawPct =
        rawOddsObj.starterOddsBasisPoints !== undefined ? (Number(rawOddsObj.starterOddsBasisPoints) / 100) :
        rawOddsObj.startingOdds !== undefined ? Number(rawOddsObj.startingOdds) :
        rawOddsObj.probability !== undefined ? Number(rawOddsObj.probability) :
        rawOddsObj.percentage !== undefined ? Number(rawOddsObj.percentage) :
        rawOddsObj.pct !== undefined ? Number(rawOddsObj.pct) :
        null;

      if (typeof rawPct === 'number' && !Number.isNaN(rawPct)) {
        if (rawPct > 0 && rawPct <= 1) rawPct = Math.round(rawPct * 100);
        else rawPct = Math.round(rawPct);
        rawPct = Math.max(0, Math.min(100, rawPct));
      } else {
        rawPct = null;
      }

      let rawGrade =
        rawOddsObj.grade ||
        rawOddsObj.tier ||
        rawOddsObj.category ||
        rawOddsObj.rank ||
        null;

      if (rawGrade) {
        rawGrade = String(rawGrade).toUpperCase().trim().slice(0, 1);
        if (!/^[A-F]$/.test(rawGrade)) rawGrade = null;
      }

      if (rawPct !== null && !rawGrade) {
        rawGrade = this.percentageToSorareGrade(rawPct);
      } else if (rawGrade && rawPct === null) {
        rawPct = this.sorareGradeToPercentage(rawGrade);
      }

      return {
        pct: isOfficialStarter ? 100 : (isOfficialBench ? 0 : rawPct),
        grade: isOfficialStarter ? 'A' : (isOfficialBench ? 'F' : rawGrade),
        officialStatus: isOfficialStarter ? 'starter' : (isOfficialBench ? 'bench' : null)
      };
    }

    return null;
  },

  computeHeuristicStartingOdds(clubStats, natStats, isNationalMatch, isInjuredOrSuspended, l15 = 0) {
    if (isInjuredOrSuspended) {
      return { pct: 0, grade: 'F', officialStatus: null, source: 'heuristic' };
    }

    const stats = isNationalMatch
      ? ((natStats && natStats.totalEntries > 0) ? natStats : clubStats)
      : clubStats;

    if (!stats || !stats.totalEntries || stats.totalEntries === 0) {
      const fallbackPct = l15 >= 52 ? 70 : (l15 >= 42 ? 60 : 30);
      return {
        pct: fallbackPct,
        grade: this.percentageToSorareGrade(fallbackPct),
        officialStatus: null,
        source: 'heuristic'
      };
    }

    const total = Math.max(1, stats.totalEntries);
    const starterRatio = stats.starterCount / total;
    const playedRatio = stats.playedCount / total;
    const recentLogs = Array.isArray(stats.matchLogs) ? stats.matchLogs : [];
    const lastMatchMins = recentLogs[0]?.mins || 0;
    const prevMatchMins = recentLogs[1]?.mins || 0;

    let pct = 50;

    if (stats.consecutiveRecentDnp >= 2) {
      pct = 20;
    } else if (stats.consecutiveRecentDnp === 1) {
      if (starterRatio >= 0.6 && stats.avgMins >= 70) {
        pct = 60; // D
      } else {
        pct = 30; // E
      }
    } else if (starterRatio >= 0.8 && stats.avgMins >= 75 && lastMatchMins >= 65) {
      pct = 90; // A
    } else if (starterRatio >= 0.65 && stats.avgMins >= 68) {
      pct = 80; // B
    } else if (starterRatio >= 0.5 && (lastMatchMins >= 55 || prevMatchMins >= 55)) {
      pct = 70; // C
    } else if (playedRatio >= 0.6 && stats.avgMins >= 42) {
      pct = 60; // D
    } else if (stats.playedCount >= 1) {
      pct = 30; // E
    } else {
      pct = 10; // F
    }

    return {
      pct,
      grade: this.percentageToSorareGrade(pct),
      officialStatus: null,
      source: 'heuristic'
    };
  },

  buildDefaultAllStarLeaderboardSlug(fixtureSlug, scarcity = 'limited') {
    const fSlug = String(fixtureSlug || 'football-17-20-nov-2026').trim();
    const r = String(scarcity || 'limited').toLowerCase().trim();
    return `${fSlug}-seasonal-all_star-all_seasons_all_star_${r}`;
  },

  formatGraphqlArgTypeString(typeObj) {
    if (!typeObj) return '[ID!]!';
    if (typeObj.kind === 'NON_NULL') {
      return `${this.formatGraphqlArgTypeString(typeObj.ofType)}!`;
    }
    if (typeObj.kind === 'LIST') {
      return `[${this.formatGraphqlArgTypeString(typeObj.ofType)}]`;
    }
    return typeObj.name || 'ID';
  },

  async fetchTypeDefinition(workerGraphqlEndpoint, token, typeName) {
    if (!typeName) return null;
    const q = `
      query GetTypeDef($name: String!) {
        __type(name: $name) {
          name
          kind
          fields {
            name
            args {
              name
              defaultValue
              type {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    try {
      const res = await fetch(workerGraphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: q, variables: { name: typeName } })
      });
      const json = await res.json();
      return json?.data?.__type || null;
    } catch (_) {
      return null;
    }
  },

  async inspectBenchSchemaIfNeeded(workerGraphqlEndpoint, token) {
    if (this.cachedBenchSchemaInfo) return this.cachedBenchSchemaInfo;

    try {
      const lbDef = await this.fetchTypeDefinition(workerGraphqlEndpoint, token, 'So5Leaderboard');
      const fields = lbDef?.fields || [];

      const benchObjectsField = fields.find(f => f.name === 'myComposeTeamBenchObjects') || null;
      const idsArg = benchObjectsField?.args?.find(a => a.name === 'ids') || null;
      const idsArgTypeStr = idsArg ? this.formatGraphqlArgTypeString(idsArg.type) : '[String!]!';

      this.cachedBenchSchemaInfo = {
        idsArgTypeStr
      };
      return this.cachedBenchSchemaInfo;
    } catch (e) {
      return {
        idsArgTypeStr: '[String!]!'
      };
    }
  },

  buildMinimalVerifiedBenchCardSelection() {
    return `
      ... on ComposeTeamBenchCard {
        id
        anyPlayer {
          slug
          displayName
        }
        eligiblePlayerGameScores {
          projectedScore
          projection {
            grade
          }
          anyPlayerGameStats {
            ... on PlayerGameStats {
              fieldStatus
              footballPlayingStatusOdds {
                starterOddsBasisPoints
                reliability
              }
            }
          }
        }
      }
    `;
  },

  buildComposeBenchObjectsByIdsQuery(sInfo) {
    const idsType = sInfo?.idsArgTypeStr || '[String!]!';
    const inner = this.buildMinimalVerifiedBenchCardSelection();

    return `
      query FootballComposeBenchByIdsQuery($slug: String!, $ids: ${idsType}) {
        so5 {
          so5Leaderboard(slug: $slug) {
            slug
            myComposeTeamBenchObjects(ids: $ids) {
              ${inner}
            }
          }
        }
      }
    `;
  },

  parseBenchObjectsIntoMap(benchItems, benchOddsMap, cardUuidToPlayerSlugMap = {}) {
    let added = 0;
    let validNodesSeen = 0;
    if (!Array.isArray(benchItems)) return { added: 0, validNodesSeen: 0 };

    benchItems.forEach(item => {
      if (!item) return;
      validNodesSeen++;

      const pObj = item?.anyPlayer || null;
      const itemUuid = this.extractPureUuid(item?.id);
      const pSlug = pObj?.slug
        ? String(pObj.slug).trim()
        : (itemUuid && cardUuidToPlayerSlugMap[itemUuid] ? cardUuidToPlayerSlugMap[itemUuid] : null);
      if (!pSlug) return;

      const rawScoresList = Array.isArray(item?.eligiblePlayerGameScores)
        ? item.eligiblePlayerGameScores
        : [];

      const firstScoreObj = rawScoresList[0] || null;
      if (!firstScoreObj) return;

      const parsedNode = this.extractOddsAndStatusFromScoreNode(firstScoreObj);
      if (parsedNode && (parsedNode.pct !== null || parsedNode.grade !== null || parsedNode.officialStatus !== null)) {
        benchOddsMap[pSlug] = parsedNode;
        added++;
      }
    });

    return { added, validNodesSeen };
  },

  async fetchOfficialBenchOddsFromLeaderboards(leaderboardSlugs = [], relevantCards = []) {
    const token = localStorage.getItem('sorare_access_token');
    if (!token) return {};

    const workerGraphqlEndpoint = this.getWorkerGraphqlEndpoint();
    const validSlugs = Array.from(new Set((leaderboardSlugs || []).filter(Boolean)));
    if (validSlugs.length === 0 || !Array.isArray(relevantCards) || relevantCards.length === 0) return {};

    const benchOddsMap = {};
    const cardUuidToPlayerSlugMap = {};
    const composeBenchUuidIds = [];

    relevantCards.forEach(c => {
      if (!c) return;
      const benchId = this.getComposeBenchCardId(c);
      if (benchId && !composeBenchUuidIds.includes(benchId)) {
        composeBenchUuidIds.push(benchId);
        const rawUuid = benchId.replace('ComposeTeamBenchCard:', '');
        if (rawUuid && c.playerSlug) {
          cardUuidToPlayerSlugMap[rawUuid] = c.playerSlug;
        }
      }
    });

    if (composeBenchUuidIds.length === 0) return {};

    const schemaInfo = await this.inspectBenchSchemaIfNeeded(workerGraphqlEndpoint, token);
    const activeQuery = this.buildComposeBenchObjectsByIdsQuery(schemaInfo);

    for (const lbSlug of validSlugs) {
      let formatAddedCount = 0;
      const chunkSize = 50;

      for (let i = 0; i < composeBenchUuidIds.length; i += chunkSize) {
        const idChunk = composeBenchUuidIds.slice(i, i + chunkSize);
        try {
          const res = await fetch(workerGraphqlEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              operationName: 'FootballComposeBenchByIdsQuery',
              query: activeQuery,
              variables: { slug: lbSlug, ids: idChunk }
            })
          });

          if (!res || !res.ok) break;
          const json = await res.json();
          if (Array.isArray(json?.errors) && json.errors.length > 0) break;

          const rawContainer = json?.data?.so5?.so5Leaderboard?.myComposeTeamBenchObjects;
          const benchItems = Array.isArray(rawContainer)
            ? rawContainer
            : (Array.isArray(rawContainer?.nodes) ? rawContainer.nodes : null);

          if (Array.isArray(benchItems) && benchItems.length > 0) {
            const parsed = this.parseBenchObjectsIntoMap(benchItems, benchOddsMap, cardUuidToPlayerSlugMap);
            formatAddedCount += parsed.added;
          } else if (i === 0) {
            break;
          }
        } catch (_) {
          break;
        }
      }

      if (formatAddedCount > 0) {
        break;
      }
    }

    return benchOddsMap;
  },

  // Costruisce una query batch aliased per leggere anyFutureGames -> playerGameScore(playerSlug: $s_i) per 15 giocatori alla volta
  buildAliasedFutureGamesBatchQuery(slugsBatch) {
    const varDefs = slugsBatch.map((_, idx) => `$s_${idx}: String!`).join(', ');
    const fieldsBody = slugsBatch.map((_, idx) => `
      p_${idx}: anyPlayer(slug: $s_${idx}) {
        ... on Player {
          slug
          displayName
          activeInjuries {
            status
          }
          activeSuspensions {
            reason
          }
          anyFutureGames(first: 4) {
            nodes {
              id
              date
              statusTyped
              playerGameScore(playerSlug: $s_${idx}) {
                ... on PlayerGameScore {
                  projectedScore
                  score
                  scoreStatus
                  projection {
                    grade
                    reliabilityBasisPoints
                  }
                  anyPlayerGameStats {
                    ... on PlayerGameStats {
                      fieldStatus
                      gameStarted
                      minsPlayed
                      anyGame {
                        id
                        date
                        statusTyped
                        so5Fixture {
                          gameWeek
                          slug
                        }
                      }
                      footballPlayingStatusOdds {
                        starterOddsBasisPoints
                        reliability
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `).join('\n');

    return `
      query GetAliasedPlayersFutureOdds(${varDefs}) {
        ${fieldsBody}
      }
    `;
  },

  async fetchLiveLineupsAndOddsForPlayers(cardsList, selectedGw = null, leaderboardSlugs = []) {
    const token = localStorage.getItem('sorare_access_token');
    if (!token || !Array.isArray(cardsList) || cardsList.length === 0) {
      return { updatedCount: 0, officialCount: 0, mapBySlug: {}, diagnostic: 'Token o carte mancanti' };
    }

    const workerGraphqlEndpoint = this.getWorkerGraphqlEndpoint();
    const nowMs = Date.now();
    const gwStartMs = selectedGw?.startDate ? new Date(selectedGw.startDate).getTime() : (nowMs - 24 * 3600 * 1000);
    const gwEndMs = selectedGw?.endDate ? new Date(selectedGw.endDate).getTime() : (nowMs + 96 * 3600 * 1000);
    const targetFixtureSlug = selectedGw?.sorareSlug ? String(selectedGw.sorareSlug).trim().toLowerCase() : null;
    const targetGwNumber = selectedGw?.gameWeek ? Number(selectedGw.gameWeek) : null;
    const activeRarity = (window.App && App.currentScarcity) ? App.currentScarcity : 'limited';

    const relevantSlugsSet = new Set();
    const relevantCards = [];

    cardsList.forEach(c => {
      if (!c || !c.playerSlug || c.isSealedInVault) return;
      const games = Array.isArray(c.scheduleGames) ? c.scheduleGames : [];
      const hasGameInGw = games.some(g => g.timestamp >= gwStartMs && g.timestamp <= gwEndMs);
      if (hasGameInGw) {
        relevantSlugsSet.add(c.playerSlug);
        relevantCards.push(c);
      }
    });

    const allSlugs = Array.from(relevantSlugsSet);
    if (allSlugs.length === 0) {
      return { updatedCount: 0, officialCount: 0, mapBySlug: {}, diagnostic: 'Nessun giocatore con gara in questa GW' };
    }

    const mapBySlug = {};
    let updatedCount = 0;
    let officialCount = 0;
    const diagNotes = [];

    const isGameMatchingSelectedGw = (gameDateStr, fixtureObj = null) => {
      if (fixtureObj) {
        if (targetFixtureSlug && fixtureObj.slug && String(fixtureObj.slug).toLowerCase() === targetFixtureSlug) {
          return true;
        }
        if (targetGwNumber && fixtureObj.gameWeek && Number(fixtureObj.gameWeek) === targetGwNumber) {
          return true;
        }
      }
      if (!gameDateStr) return false;
      const gTs = new Date(gameDateStr).getTime();
      return gTs >= (gwStartMs - 6 * 3600 * 1000) && gTs <= (gwEndMs + 6 * 3600 * 1000);
    };

    // 1. SORGENTE PRIMARIA DEFINITIVA: anyPlayer(slug: $s_i) -> anyFutureGames -> playerGameScore(playerSlug: $s_i)
    const futureBatchSize = 15;
    for (let i = 0; i < allSlugs.length; i += futureBatchSize) {
      const batch = allSlugs.slice(i, i + futureBatchSize);
      const aliasedQuery = this.buildAliasedFutureGamesBatchQuery(batch);
      const vars = {};
      batch.forEach((slugVal, idx) => {
        vars[`s_${idx}`] = slugVal;
      });

      try {
        const res = await fetch(workerGraphqlEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            operationName: 'GetAliasedPlayersFutureOdds',
            query: aliasedQuery,
            variables: vars
          })
        });

        const json = await res.json();
        if (Array.isArray(json?.errors) && json.errors.length > 0) {
          diagNotes.push(`GQL future: ${json.errors[0].message}`);
        }

        const dataObj = json?.data || {};
        batch.forEach((origSlug, idx) => {
          const pNode = dataObj[`p_${idx}`];
          if (!pNode) return;
          const pSlug = (pNode.slug || origSlug).trim();

          const isNowInjured =
            (Array.isArray(pNode.activeInjuries) && pNode.activeInjuries.length > 0) ||
            (Array.isArray(pNode.activeSuspensions) && pNode.activeSuspensions.length > 0);

          if (isNowInjured) {
            mapBySlug[pSlug] = {
              pct: 0,
              grade: 'F',
              officialStatus: 'out',
              source: 'sorare_official_injury',
              updatedAt: nowMs
            };
            updatedCount++;
            officialCount++;
            return;
          }

          const futureNodes = Array.isArray(pNode.anyFutureGames?.nodes) ? pNode.anyFutureGames.nodes : [];
          for (const fGame of futureNodes) {
            const scoreObj = fGame?.playerGameScore;
            if (!scoreObj) continue;
            const fixtureObj = scoreObj?.anyPlayerGameStats?.anyGame?.so5Fixture || null;
            const gameDate = fGame.date || scoreObj?.anyPlayerGameStats?.anyGame?.date || null;

            if (isGameMatchingSelectedGw(gameDate, fixtureObj)) {
              const extracted = this.extractOddsAndStatusFromScoreNode(scoreObj);
              if (extracted && (extracted.pct !== null || extracted.grade !== null || extracted.officialStatus !== null)) {
                mapBySlug[pSlug] = extracted;
                updatedCount++;
                if (extracted.officialStatus) officialCount++;
                break;
              }
            }
          }
        });
      } catch (err) {
        diagNotes.push(`Net future: ${err.message}`);
      }
    }

    // 2. SORGENTE LIVE & PARTITE GIÀ INIZIATE: football.players(slugs: $slugs) -> so5Scores
    const remainingSlugs = allSlugs.filter(s => !mapBySlug[s] || !mapBySlug[s].officialStatus);
    const liveChunkSize = 35;

    for (let i = 0; i < remainingSlugs.length; i += liveChunkSize) {
      const chunk = remainingSlugs.slice(i, i + liveChunkSize);
      const safeLiveQuery = `
        query GetLivePlayerStatusSafe($slugs: [String!]!) {
          football {
            players(slugs: $slugs) {
              slug
              activeInjuries {
                status
              }
              activeSuspensions {
                reason
              }
              so5Scores(last: 4) {
                score
                scoreStatus
                projectedScore
                projection {
                  grade
                }
                anyPlayerGameStats {
                  ... on PlayerGameStats {
                    fieldStatus
                    gameStarted
                    minsPlayed
                    footballPlayingStatusOdds {
                      starterOddsBasisPoints
                      reliability
                    }
                  }
                }
                playerGameStats {
                  minsPlayed
                }
                game {
                  id
                  date
                  statusTyped
                }
              }
            }
          }
        }
      `;

      try {
        const res = await fetch(workerGraphqlEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            operationName: 'GetLivePlayerStatusSafe',
            query: safeLiveQuery,
            variables: { slugs: chunk }
          })
        });

        if (res && res.ok) {
          const json = await res.json();
          const playersNodes = json?.data?.football?.players || [];
          playersNodes.forEach(pNode => {
            if (!pNode || !pNode.slug) return;
            const pSlug = pNode.slug.trim();

            const isNowInjured =
              (Array.isArray(pNode.activeInjuries) && pNode.activeInjuries.length > 0) ||
              (Array.isArray(pNode.activeSuspensions) && pNode.activeSuspensions.length > 0);

            if (isNowInjured) {
              if (!mapBySlug[pSlug]) updatedCount++;
              mapBySlug[pSlug] = {
                pct: 0,
                grade: 'F',
                officialStatus: 'out',
                source: 'sorare_official_injury',
                updatedAt: nowMs
              };
              officialCount++;
              return;
            }

            const recentScores = Array.isArray(pNode.so5Scores) ? pNode.so5Scores : [];
            for (const sNode of recentScores) {
              const gDate = sNode?.game?.date || null;
              if (!isGameMatchingSelectedGw(gDate, null)) continue;

              const extracted = this.extractOddsAndStatusFromScoreNode(sNode);
              if (extracted && (extracted.officialStatus || !mapBySlug[pSlug])) {
                if (!mapBySlug[pSlug]) updatedCount++;
                mapBySlug[pSlug] = extracted;
                if (extracted.officialStatus) officialCount++;
                return;
              }

              const gDateMs = gDate ? new Date(gDate).getTime() : 0;
              const gStatus = String(sNode?.game?.statusTyped || '').toLowerCase();
              const mins = sNode?.playerGameStats?.minsPlayed ?? sNode?.anyPlayerGameStats?.minsPlayed;
              const sc = sNode?.score;
              const timeToKickoffMin = (gDateMs - nowMs) / (60 * 1000);

              if (timeToKickoffMin <= 75) {
                if ((typeof mins === 'number' && mins > 0) || (typeof sc === 'number' && sc > 0)) {
                  if (!mapBySlug[pSlug]) updatedCount++;
                  mapBySlug[pSlug] = {
                    pct: 100,
                    grade: 'A',
                    officialStatus: 'starter',
                    liveScore: sc,
                    liveMins: mins,
                    source: 'sorare_live',
                    updatedAt: nowMs
                  };
                  officialCount++;
                  return;
                } else if (gStatus === 'playing' || gStatus === 'played' || timeToKickoffMin <= 0) {
                  if (!mapBySlug[pSlug]) updatedCount++;
                  mapBySlug[pSlug] = {
                    pct: 0,
                    grade: 'F',
                    officialStatus: 'bench',
                    liveScore: 0,
                    liveMins: 0,
                    source: 'sorare_live',
                    updatedAt: nowMs
                  };
                  officialCount++;
                  return;
                }
              }
            }
          });
        }
      } catch (_) {}
    }

    // 3. Fallback sulla Leaderboard se manca ancora qualche giocatore
    const missingCards = relevantCards.filter(c => !mapBySlug[c.playerSlug]);
    if (missingCards.length > 0) {
      try {
        const candidateLbSlugs = Array.isArray(leaderboardSlugs) && leaderboardSlugs.length > 0
          ? [...leaderboardSlugs]
          : [];
        const defaultAllStarSlug = this.buildDefaultAllStarLeaderboardSlug(selectedGw?.sorareSlug, activeRarity);
        if (!candidateLbSlugs.includes(defaultAllStarSlug)) {
          candidateLbSlugs.unshift(defaultAllStarSlug);
        }

        const benchMap = await this.fetchOfficialBenchOddsFromLeaderboards(candidateLbSlugs, missingCards);
        Object.keys(benchMap).forEach(pSlug => {
          if (!mapBySlug[pSlug]) {
            mapBySlug[pSlug] = benchMap[pSlug];
            updatedCount++;
            if (benchMap[pSlug].officialStatus) officialCount++;
          }
        });
      } catch (_) {}
    }

    this.lastBenchDiagnostic = updatedCount > 0
      ? `OK (${updatedCount} giocatori aggiornati con quote ufficiali Sorare / stato live)`
      : (diagNotes.length > 0
          ? diagNotes.slice(0, 2).join(' | ')
          : `Verificati ${allSlugs.length} giocatori su Sorare (quote non ancora pubblicate per questa GW)`);

    return {
      updatedCount,
      officialCount,
      mapBySlug,
      diagnostic: this.lastBenchDiagnostic
    };
  },

  async fetchCurrentUserGallery(forceRefresh = false) {
    const token = localStorage.getItem('sorare_access_token');
    if (!token) return null;

    if (!forceRefresh) {
      const cached = this.loadAnyAvailableCache(false, [this.CACHE_KEY]);
      if (cached) {
        return {
          user: cached.user,
          gameweeks: this.buildOfficialSorareGameweeks(),
          cards: cached.cards
        };
      }
    }

    const workerGraphqlEndpoint = this.getWorkerGraphqlEndpoint();

    // Query galleria pulita e veloce (senza campi che richiedono parametri per-giocatore)
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
              id
              assetId
              slug
              name
              rarityTyped
              seasonYear
              inSeasonUntil
              power
              sealed
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
                    projectedScore
                    projection {
                      grade
                    }
                    decisiveScore {
                      totalScore
                    }
                    anyPlayerGameStats {
                      ... on PlayerGameStats {
                        fieldStatus
                        footballPlayingStatusOdds {
                          starterOddsBasisPoints
                        }
                      }
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
                      id
                      date
                      homeGoals
                      awayGoals
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
                    upcomingGames(first: 5) {
                      id
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
                      id
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
          App.notify(`📥 Scaricate ${allCards.length} carte Pro...`);
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

  isOfficialSorareScoredMatch(scoreNode, isNationalMatch = false) {
    if (!scoreNode || !scoreNode.game) return false;
    const g = scoreNode.game;
    const compSlug = String(g.competition?.slug || '').toLowerCase().trim();
    const compName = String(g.competition?.displayName || '').toLowerCase().trim();

    if (!isNationalMatch) {
      if (
        !compSlug ||
        compSlug.includes('friendl') ||
        compSlug.includes('hybrid') ||
        compSlug.includes('test') ||
        compSlug.includes('exhibition') ||
        compName.includes('amichevol') ||
        compName.includes('friendl')
      ) {
        return false;
      }
    }

    const sc = typeof scoreNode.score === 'number' ? scoreNode.score : null;
    const dec = typeof scoreNode.decisiveScore?.totalScore === 'number' ? scoreNode.decisiveScore.totalScore : null;
    const mins = typeof scoreNode.playerGameStats?.minsPlayed === 'number' ? scoreNode.playerGameStats.minsPlayed : 0;

    if (sc === null) return false;
    if ((mins > 0 || sc > 0) && (dec === null || dec < 15)) {
      return false;
    }

    return true;
  },

  buildDynamicTeamFormMap(rawCards) {
    const teamGamesMap = new Map();

    const registerTeamGame = (teamSlug, teamName, gameKey, dateMs, gf, ga, playerScore) => {
      if (!teamSlug) return;
      const slug = teamSlug.toLowerCase();
      if (!teamGamesMap.has(slug)) {
        teamGamesMap.set(slug, { name: teamName || slug, games: new Map() });
      }
      const teamEntry = teamGamesMap.get(slug);
      if (!teamEntry.games.has(gameKey)) {
        teamEntry.games.set(gameKey, {
          dateMs,
          gf: typeof gf === 'number' ? gf : null,
          ga: typeof ga === 'number' ? ga : null,
          scoreSum: playerScore > 0 ? playerScore : 0,
          scoreCount: playerScore > 0 ? 1 : 0
        });
      } else if (playerScore > 0) {
        const g = teamEntry.games.get(gameKey);
        g.scoreSum += playerScore;
        g.scoreCount += 1;
      }
    };

    (rawCards || []).forEach(card => {
      const scores = card?.player?.so5Scores;
      if (!Array.isArray(scores)) return;
      scores.forEach(s => {
        if (!this.isOfficialSorareScoredMatch(s, true)) return;
        const g = s?.game;
        if (!g || !g.date) return;
        const dateMs = new Date(g.date).getTime();
        if (!dateMs) return;
        const dayKey = new Date(dateMs).toISOString().slice(0, 10);
        const homeSlug = (g.homeTeam?.slug || '').toLowerCase();
        const awaySlug = (g.awayTeam?.slug || '').toLowerCase();
        if (!homeSlug || !awaySlug) return;

        const gameKey = `${dayKey}_${homeSlug}_${awaySlug}`;
        const hg = typeof g.homeGoals === 'number' ? g.homeGoals : null;
        const ag = typeof g.awayGoals === 'number' ? g.awayGoals : null;
        const pScore = typeof s.score === 'number' ? s.score : 0;

        registerTeamGame(homeSlug, g.homeTeam?.name, gameKey, dateMs, hg, ag, pScore);
        registerTeamGame(awaySlug, g.awayTeam?.name, gameKey, dateMs, ag, hg, pScore);
      });
    });

    const computedFormMap = {};
    teamGamesMap.forEach((entry, slug) => {
      const sortedGames = Array.from(entry.games.values())
        .sort((a, b) => b.dateMs - a.dateMs)
        .slice(0, 5);

      const latestClubGameMs = sortedGames[0]?.dateMs || 0;
      let matchesWithGoals = 0;
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let gfTotal = 0;
      let gaTotal = 0;
      let cleanSheets = 0;
      let avgPlayerSo5Sum = 0;
      let avgPlayerSo5Count = 0;

      sortedGames.forEach(g => {
        if (g.gf !== null && g.ga !== null) {
          matchesWithGoals++;
          gfTotal += g.gf;
          gaTotal += g.ga;
          if (g.ga === 0) cleanSheets++;
          if (g.gf > g.ga) wins++;
          else if (g.gf === g.ga) draws++;
          else losses++;
        }
        if (g.scoreCount > 0) {
          avgPlayerSo5Sum += (g.scoreSum / g.scoreCount);
          avgPlayerSo5Count++;
        }
      });

      if (matchesWithGoals > 0) {
        const avgGf = Number((gfTotal / matchesWithGoals).toFixed(2));
        const avgGa = Number((gaTotal / matchesWithGoals).toFixed(2));
        const winRate = wins / matchesWithGoals;
        const rawStrength = 0.50 + ((winRate - 0.45) * 0.45) + ((avgGf - avgGa) * 0.12);
        const strengthIndex = Number(Math.max(0.15, Math.min(0.92, rawStrength)).toFixed(2));

        computedFormMap[slug] = {
          sampleSize: matchesWithGoals,
          latestClubGameMs,
          wins,
          draws,
          losses,
          recordStr: `${wins}V-${draws}P-${losses}S`,
          avgGf,
          avgGa,
          cleanSheets,
          strengthIndex
        };
      } else if (avgPlayerSo5Count > 0) {
        const teamAvgSo5 = avgPlayerSo5Sum / avgPlayerSo5Count;
        const strengthIndex = Number(Math.max(0.25, Math.min(0.85, teamAvgSo5 / 80)).toFixed(2));
        computedFormMap[slug] = {
          sampleSize: avgPlayerSo5Count,
          latestClubGameMs,
          wins: null,
          draws: null,
          losses: null,
          recordStr: null,
          avgGf: null,
          avgGa: null,
          cleanSheets: 0,
          strengthIndex
        };
      }
    });

    return computedFormMap;
  },

  enrichCardsWithRealOptaData(rawCards) {
    const nowMs = Date.now();
    const dynamicTeamFormMap = this.buildDynamicTeamFormMap(rawCards);

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
          if (!s || !s.game) return;
          const isNat = isGameNational(s.game, false);
          if (!this.isOfficialSorareScoredMatch(s, isNat)) return;

          const compSlug = String(s.game?.competition?.slug || '').toLowerCase();
          if (isNat) {
            natScoreEntries.push(s);
          } else {
            clubScoreEntries.push(s);
            if (compSlug) activeClubCompetitionsSet.add(compSlug);
          }
        });

        (Array.isArray(club.upcomingGames) ? club.upcomingGames : []).forEach(g => {
          const compSlug = String(g?.competition?.slug || '').toLowerCase();
          if (compSlug && !compSlug.includes('friendl')) {
            activeClubCompetitionsSet.add(compSlug);
          }
        });

        const computeSplitMetrics = (entries, maxWindow = 6, refTeamSlug = clubSlug) => {
          const slice = entries.slice(0, maxWindow);
          let totalEntries = slice.length;
          let playedCount = 0;
          let starterCount = 0;
          let dnpZeroCount = 0;
          let consecutiveRecentDnp = 0;
          let stillCountingRecentDnp = true;
          let lastPlayedDateMs = 0;
          let latestEntryDateMs = 0;
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
          let totalDefActions = 0;
          let totalDuelsWon = 0;

          slice.forEach(s => {
            const sc = typeof s.score === 'number' ? Number(s.score.toFixed(1)) : 0;
            const stats = s.playerGameStats || {};
            const mins = typeof stats.minsPlayed === 'number' ? stats.minsPlayed : (sc > 0 ? 60 : 0);

            const g = s.game || {};
            const gDateMs = g.date ? new Date(g.date).getTime() : 0;
            if (gDateMs > latestEntryDateMs) latestEntryDateMs = gDateMs;

            const rawDecisiveTotal = typeof s.decisiveScore?.totalScore === 'number'
              ? Number(s.decisiveScore.totalScore.toFixed(1))
              : (mins >= 55 ? 35 : (mins > 0 ? 15 : 0));

            const baseStartingPts = mins >= 45 ? 35 : (mins > 0 ? 15 : 0);
            const netDecisiveBonus = Math.max(0, Number((rawDecisiveTotal - baseStartingPts).toFixed(1)));
            const pureAas = Number((sc - rawDecisiveTotal).toFixed(1));

            const homeSlug = (g.homeTeam?.slug || '').toLowerCase();
            const homeName = g.homeTeam?.name || 'Casa';
            const awayName = g.awayTeam?.name || 'Trasferta';
            const isHome = refTeamSlug ? (homeSlug === refTeamSlug) : true;
            const oppName = isHome ? awayName : homeName;
            const compName = g.competition?.displayName || g.competition?.slug || '';

            const gGoals = stats.goals || 0;
            const gAssists = stats.goalAssist || 0;
            const gCs = stats.cleanSheet || 0;
            const gSaves = stats.saves || 0;
            const gPass = stats.accuratePass || 0;
            const gSot = stats.ontargetScoringAtt || 0;
            const gDef = (stats.wonTackle || 0) + (stats.interceptionWon || 0) + (stats.effectiveClearance || 0);
            const gDuels = stats.duelWon || 0;

            if (mins > 0 || sc > 0) {
              stillCountingRecentDnp = false;
              if (gDateMs > lastPlayedDateMs) lastPlayedDateMs = gDateMs;
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
                competitionName: compName,
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
              if (stillCountingRecentDnp) consecutiveRecentDnp++;
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
            consecutiveRecentDnp,
            lastPlayedDateMs,
            latestEntryDateMs,
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

        const clubStats = computeSplitMetrics(clubScoreEntries, 6, clubSlug);
        const natStats = computeSplitMetrics(natScoreEntries, 6, natSlug);

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

          const isNationalMatch = isGameNational(g, isNatSource);

          if (!isNationalMatch && (compSlug.includes('friendl') || compName.toLowerCase().includes('friendl'))) {
            return;
          }

          const dayKey = new Date(ts).toISOString().slice(0, 10);
          const dedupKey = `${dayKey}_${homeSlug || homeName}_${awaySlug || awayName}`;
          if (seenGameKeys.has(dedupKey)) return;
          seenGameKeys.add(dedupKey);

          if (isNationalMatch) {
            const isHome = natSlug ? (homeSlug === natSlug) : true;
            const myNatName = natName || (isHome ? homeName : awayName);
            const oppName = isHome ? awayName : homeName;
            const oppSlug = isHome ? awaySlug : homeSlug;
            scheduleGames.push({
              id: g.id || '',
              date: g.date,
              timestamp: ts,
              competitionSlug: compSlug || 'international',
              competitionName: compName || 'Nazionale',
              isHome: isHome,
              opponentName: oppName,
              opponentSlug: oppSlug,
              opponentForm: dynamicTeamFormMap[oppSlug] || null,
              isNationalTeam: true,
              alreadyPlayedScore: alreadyPlayedScore,
              alreadyPlayedMins: alreadyPlayedMins,
              teamName: `${myNatName} vs ${oppName}`
            });
          } else {
            const isHome = homeSlug === clubSlug;
            const oppName = isHome ? awayName : homeName;
            const oppSlug = isHome ? awaySlug : homeSlug;
            scheduleGames.push({
              id: g.id || '',
              date: g.date,
              timestamp: ts,
              competitionSlug: compSlug || leagueSlug,
              competitionName: compName || leagueName,
              isHome: isHome,
              opponentName: oppName,
              opponentSlug: oppSlug,
              opponentForm: dynamicTeamFormMap[oppSlug] || null,
              isNationalTeam: false,
              alreadyPlayedScore: alreadyPlayedScore,
              alreadyPlayedMins: alreadyPlayedMins,
              teamName: clubName
            });
          }
        };

        allRecentScores.forEach(s => {
          if (!s || !s.game || !s.game.date) return;
          const isNat = isGameNational(s.game, false);
          if (!this.isOfficialSorareScoredMatch(s, isNat)) return;
          const sc = typeof s.score === 'number' ? Number(s.score.toFixed(1)) : 0;
          const mins = typeof s.playerGameStats?.minsPlayed === 'number' ? s.playerGameStats.minsPlayed : 0;
          pushUniqueGame(s.game, isNat, sc, mins);
        });

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

        const apiL5 = typeof player.l5 === 'number' ? Number(player.l5.toFixed(1)) : 0;
        const apiL15 = typeof player.l15 === 'number' ? Number(player.l15.toFixed(1)) : 0;

        const clubL5 = clubStats.avgScore > 0 ? clubStats.avgScore : apiL5;
        const l15 = apiL15 > 0 ? apiL15 : clubL5;
        const natL5 = natStats.avgScore > 0 ? natStats.avgScore : l15;

        const isSealedInVault = Boolean(card.sealed);
        const injuries = Array.isArray(player.activeInjuries) ? player.activeInjuries : [];
        const suspensions = Array.isArray(player.activeSuspensions) ? player.activeSuspensions : [];
        const isInjured = injuries.length > 0;
        const isSuspended = suspensions.length > 0;

        const isKnownLongTermInjured =
          this.KNOWN_LONG_TERM_INJURED_SLUGS.has(canonicalPlayerSlug) ||
          canonicalPlayerSlug.includes('mohamed-ali-zoma');

        const latestClubMatchKnownMs = Math.max(
          clubStats.latestEntryDateMs || 0,
          dynamicTeamFormMap[clubSlug]?.latestClubGameMs || 0
        );

        const daysSinceLastClubAppearance = clubStats.lastPlayedDateMs > 0
          ? Math.round((nowMs - clubStats.lastPlayedDateMs) / (24 * 3600 * 1000))
          : 999;

        const clubPlayedWithoutHimRecently =
          latestClubMatchKnownMs > 0 &&
          clubStats.lastPlayedDateMs > 0 &&
          (latestClubMatchKnownMs - clubStats.lastPlayedDateMs) >= (14 * 24 * 3600 * 1000);

        const isInferredLongTermInactive =
          isKnownLongTermInjured ||
          (clubStats.consecutiveRecentDnp >= 3) ||
          (clubStats.totalEntries >= 3 && clubStats.playedCount === 0) ||
          (daysSinceLastClubAppearance >= 22 && (clubPlayedWithoutHimRecently || clubStats.consecutiveRecentDnp >= 2 || apiL5 === 0));

        const isInjuredOrSuspended = isInjured || isSuspended || isInferredLongTermInactive;

        let clubFitnessTier = 'last_resort';
        if (!isInjuredOrSuspended) {
          if (
            (clubStats.starterCount >= 3 && clubStats.consecutiveRecentDnp <= 1) ||
            (clubStats.playedCount >= 3 && clubStats.avgMins >= 62 && clubStats.consecutiveRecentDnp <= 1) ||
            (clubStats.starterCount >= 2 && clubStats.totalEntries <= 3 && clubStats.consecutiveRecentDnp === 0)
          ) {
            clubFitnessTier = 'starter';
          } else if (clubStats.playedCount >= 1 || clubL5 > 0) {
            clubFitnessTier = 'rotation';
          }
        }

        let natFitnessTier = 'unverified_nat';
        if (!isInjuredOrSuspended) {
          if (natStats.starterCount >= 2 || (natStats.starterCount >= 1 && natStats.dnpZeroCount === 0 && natStats.avgMins >= 55)) {
            natFitnessTier = 'starter';
          } else if (natStats.playedCount >= 1 || (clubFitnessTier === 'starter' && l15 >= 50)) {
            natFitnessTier = 'rotation';
          }
        }

        const clubStartingOdds = this.computeHeuristicStartingOdds(clubStats, natStats, false, isInjuredOrSuspended, l15);
        const natStartingOdds = this.computeHeuristicStartingOdds(clubStats, natStats, true, isInjuredOrSuspended, l15);

        let baseUnavailableReason = '';
        if (isSealedInVault) baseUnavailableReason = 'Carta in Cassaforte (Vault Sorare)';
        else if (isInjured) baseUnavailableReason = 'Infortunato (Ufficiale Sorare)';
        else if (isSuspended) baseUnavailableReason = 'Squalificato (Ufficiale Sorare)';
        else if (isKnownLongTermInjured) baseUnavailableReason = 'Lungodegente / Infortunio di lungo corso';
        else if (isInferredLongTermInactive) {
          baseUnavailableReason = `Assente / Inattivo da ${daysSinceLastClubAppearance < 900 ? `${daysSinceLastClubAppearance} giorni` : `${clubStats.consecutiveRecentDnp} gare consecutive`}`;
        }

        const rawPower = parseFloat(card.power) || (isInSeason ? 1.05 : 1.00);
        const totalBonusPct = Math.round((rawPower - 1) * 100);

        const extractedUuid =
          this.extractPureUuid(card.id) ||
          this.extractPureUuid(card.assetId) ||
          this.extractCardUuidFromPictureUrl(card.pictureUrl);

        return {
          id: card.slug || `c_${index}`,
          cardUuid: extractedUuid,
          composeBenchId: extractedUuid ? `ComposeTeamBenchCard:${extractedUuid}` : null,
          playerSlug: canonicalPlayerSlug,
          name: playerName,
          avatarUrl: player.pictureUrl || card.pictureUrl || null,
          pictureUrl: card.pictureUrl || player.pictureUrl || null,
          club: clubName,
          clubSlug: clubSlug,
          nationalTeamName: natName || 'Nazionale',
          nationalTeamSlug: natSlug,
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
          isSealedInVault: isSealedInVault,
          isInjuredOrSuspended: isInjuredOrSuspended,
          isInferredLongTermInactive: isInferredLongTermInactive,
          l5: clubL5,
          clubL5: clubL5,
          natL5: natL5,
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
          clubStartingOdds: clubStartingOdds,
          natStartingOdds: natStartingOdds,
          liveLineupStatus: null,
          liveStartingOddsPct: null,
          liveStartingGrade: null,
          officialProjectedScore: null,
          baseUnavailableReason: baseUnavailableReason,
          tacticalTraits: {
            cleanSheets: clubStats.cleanSheets,
            goals: clubStats.goals,
            assists: clubStats.assists,
            saves: clubStats.saves,
            avgPasses: clubStats.avgPasses,
            avgDefActions: clubStats.avgDefActions,
            avgDuelsWon: clubStats.avgDuelsWon,
            avgShotsOnTarget: clubStats.avgShotsOnTarget
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
