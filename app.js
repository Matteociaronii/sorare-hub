// SorareHub - Application Controller + Account Menu (Logout) + Vault Filter + Collapsible Strips + Target Threshold + Anytime Entry + 4-Lives + Pre-Set Alert
const App = {
  PRESET_STORAGE_KEY: 'sorarehub_preset_lineups_v1',
  LOGOUT_FLAG_KEY: 'sorarehub_manual_logout',
  cards: [],
  gameweeks: [],
  lastGeneratedLineups: [],
  presetLineups: [],
  sorareFixturesBySlug: {},
  usedCardsByGwSlug: {},
  unlockedUsedCardSlugs: new Set(),
  unlockedVaultCardIds: new Set(),
  openCollapsiblePanels: new Set(),
  selectedGwIndex: 0,
  selectedClubSlug: 'ALL',
  targetThreshold: 0,
  anytimeWindow: 'ALL',
  portfolioMode: 'cascade',
  manualOverrides: {},
  user: null,
  isLoggingOut: false,
  currentScarcity: 'limited',
  currentStrategy: 'floor',
  currentCompetition: (window.CONFIG && CONFIG.OFFICIAL_COMPETITIONS && CONFIG.OFFICIAL_COMPETITIONS[0]) || {
    id: 'all_star_classic_so7',
    name: 'All-Star',
    format: 'SO7',
    leagues: ['ALL'],
    inSeasonRequired: 0,
    allowNationalTeams: true
  },

  async init() {
    this.loadSavedPresets();
    this.injectFavicon();
    this.injectTacticalStyles();
    this.ensureBannerElement();
    this.populateCompetitionDropdown();
    this.patchOAuthFlowGuard();
    this.bindEvents();

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      sessionStorage.removeItem(this.LOGOUT_FLAG_KEY);
      this.notify('🔐 Autenticazione Sorare in corso...');
      const token = await SorareAPI.handleOAuthCallback(code);
      if (token) {
        await this.loadUserGallery(true);
      }
      return;
    }

    if (sessionStorage.getItem(this.LOGOUT_FLAG_KEY) === '1') {
      localStorage.removeItem('sorare_access_token');
      this.renderEmptyState();
      return;
    }

    if (localStorage.getItem('sorare_access_token')) {
      await this.loadUserGallery(false);
    } else {
      this.renderEmptyState();
    }
  },

  patchOAuthFlowGuard() {
    if (!window.SorareAPI || SorareAPI.__shPatched) return;
    const originalStartOAuth = SorareAPI.startOAuthFlow.bind(SorareAPI);
    SorareAPI.__rawStartOAuth = originalStartOAuth;
    SorareAPI.__shPatched = true;

    SorareAPI.startOAuthFlow = async (...args) => {
      if (this.isLoggingOut) return;
      const loginBtn = document.getElementById('login-btn') || document.getElementById('connect-btn');
      const isConnected = Boolean(localStorage.getItem('sorare_access_token')) || Boolean(this.user) || (this.cards && this.cards.length > 0);
      if (isConnected) {
        this.toggleAccountMenu(loginBtn);
        return;
      }
      sessionStorage.removeItem(this.LOGOUT_FLAG_KEY);
      return originalStartOAuth(...args);
    };
  },

  toggleAccountMenu(anchorBtn) {
    const existing = document.getElementById('sh-account-popover');
    if (existing) {
      existing.remove();
      return;
    }
    if (!anchorBtn) return;

    const rect = anchorBtn.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.id = 'sh-account-popover';
    popover.className = 'sh-account-popover';
    popover.style.top = `${Math.round(rect.bottom + window.scrollY + 8)}px`;
    popover.style.left = `${Math.max(12, Math.round(rect.right + window.scrollX - 210))}px`;

    popover.innerHTML = `
      <div class="sh-account-header">
        Account connesso: <strong>@${this.escapeHtml(this.user?.nickname || 'Manager')}</strong>
      </div>
      <button type="button" class="sh-account-item" id="sh-btn-sync-now">
        <span>🔄</span>
        <span>Sincronizza Galleria</span>
      </button>
      <button type="button" class="sh-account-item logout" id="sh-btn-logout">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span>Log out</span>
      </button>
    `;

    document.body.appendChild(popover);

    const syncBtn = document.getElementById('sh-btn-sync-now');
    if (syncBtn) {
      syncBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        popover.remove();
        this.loadUserGallery(true);
      });
    }

    const logoutBtn = document.getElementById('sh-btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        popover.remove();
        this.logoutUser();
      });
    }
  },

  logoutUser() {
    this.isLoggingOut = true;
    sessionStorage.setItem(this.LOGOUT_FLAG_KEY, '1');

    localStorage.removeItem('sorare_access_token');
    localStorage.removeItem('sorare_oauth_state');
    if (window.SorareAPI && Array.isArray(SorareAPI.FALLBACK_CACHE_KEYS)) {
      SorareAPI.FALLBACK_CACHE_KEYS.forEach(k => localStorage.removeItem(k));
    }
    localStorage.removeItem('sorarehub_gallery_cache_v27');
    localStorage.removeItem('sorarehub_gallery_cache_v26');
    localStorage.removeItem('sorarehub_gallery_cache_v25');

    if (window.location.search) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    this.user = null;
    this.cards = [];
    this.lastGeneratedLineups = [];
    this.sorareFixturesBySlug = {};
    this.usedCardsByGwSlug = {};
    this.unlockedUsedCardSlugs.clear();
    this.unlockedVaultCardIds.clear();
    this.manualOverrides = {};
    this.selectedClubSlug = 'ALL';

    const existingPopover = document.getElementById('sh-account-popover');
    if (existingPopover) existingPopover.remove();

    const loginBtn = document.getElementById('login-btn') || document.getElementById('connect-btn');
    const loginBtnText = document.getElementById('login-btn-text') || loginBtn;
    if (loginBtn) {
      loginBtn.classList.remove('connected');
      loginBtn.disabled = false;
    }
    if (loginBtnText) {
      loginBtnText.textContent = 'Connetti Sorare';
    }

    const controlsContainer = document.getElementById('gw-selector-container');
    if (controlsContainer) {
      controlsContainer.innerHTML = '';
    }

    const elTotal = document.getElementById('stat-total-cards');
    const elUser = document.getElementById('stat-user-slug');
    const elInSeason = document.getElementById('stat-inseason-cards');
    const elStarters = document.getElementById('stat-starters');
    const elBuilt = document.getElementById('stat-lineups-built');

    if (elTotal) elTotal.textContent = '0';
    if (elUser) elUser.textContent = 'Non connesso';
    if (elInSeason) elInSeason.textContent = '0';
    if (elStarters) elStarters.textContent = '0';
    if (elBuilt) elBuilt.textContent = '0';

    this.renderEmptyState();
    this.notify('🚪 Disconnessione effettuata. Clicca su "Connetti Sorare" quando vorrai ricollegarti.');

    setTimeout(() => {
      this.isLoggingOut = false;
    }, 600);
  },

  loadSavedPresets() {
    try {
      const raw = localStorage.getItem(this.PRESET_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.presetLineups = parsed;
      }
    } catch (_) {
      this.presetLineups = [];
    }
  },

  savePresetsToStorage() {
    try {
      localStorage.setItem(this.PRESET_STORAGE_KEY, JSON.stringify(this.presetLineups));
    } catch (_) {}
  },

  pinLineupAsPreset(lineupIndex) {
    const lineup = this.lastGeneratedLineups[lineupIndex];
    if (!lineup || !Array.isArray(lineup.starters)) return;

    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;
    const presetEntry = {
      id: 'preset_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      label: `Pre-Set Step ${this.presetLineups.length + 1} • ${lineup.rankLabel}`,
      competitionName: this.currentCompetition.name,
      scarcity: this.currentScarcity,
      gwLabel: selectedGw ? selectedGw.label : 'GW Attiva',
      totalProjected: lineup.totalProjected,
      cardIds: lineup.starters.map(s => s.id),
      players: lineup.starters.map(s => ({
        cardId: s.id,
        playerSlug: s.playerSlug,
        name: s.name,
        club: s.club,
        position: s.displayRole || s.position
      }))
    };

    this.presetLineups.push(presetEntry);
    this.savePresetsToStorage();
    this.notify(`📌 ${presetEntry.label} fissata! Le sue ${presetEntry.cardIds.length} carte sono ora riservate mentre prepari lo step successivo.`);
    this.runOptimizer();
  },

  removePreset(presetId) {
    this.presetLineups = this.presetLineups.filter(p => p.id !== presetId);
    this.savePresetsToStorage();
    this.runOptimizer();
  },

  clearAllPresets() {
    this.presetLineups = [];
    this.savePresetsToStorage();
    this.runOptimizer();
  },

  getPresetReservedCardIdsSet() {
    const set = new Set();
    (this.presetLineups || []).forEach(p => {
      if (p.scarcity && p.scarcity !== this.currentScarcity) return;
      (p.cardIds || []).forEach(id => set.add(id));
    });
    return set;
  },

  isCardLockedInVault(card) {
    if (!card) return false;
    return Boolean(card.isSealedInVault) && !this.unlockedVaultCardIds.has(card.id);
  },

  evaluatePresetDnpAlerts() {
    const alerts = [];
    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;

    (this.presetLineups || []).forEach(preset => {
      (preset.players || []).forEach(pl => {
        const liveCard = this.cards.find(c => c.id === pl.cardId || c.playerSlug === pl.playerSlug);
        if (!liveCard) return;

        if (this.isCardLockedInVault(liveCard)) {
          alerts.push({
            presetId: preset.id,
            presetLabel: preset.label,
            playerName: liveCard.name,
            reason: 'Carta chiusa in Cassaforte (Vault)'
          });
          return;
        }

        if (liveCard.isInjuredOrSuspended && this.manualOverrides[liveCard.playerSlug] !== 'xi') {
          alerts.push({
            presetId: preset.id,
            presetLabel: preset.label,
            playerName: liveCard.name,
            reason: liveCard.baseUnavailableReason || 'Infortunato / Squalificato'
          });
          return;
        }

        if (this.manualOverrides[liveCard.playerSlug] === 'bench') {
          alerts.push({
            presetId: preset.id,
            presetLabel: preset.label,
            playerName: liveCard.name,
            reason: 'Spostato manualmente in Panchina'
          });
          return;
        }

        if (selectedGw && selectedGw.startDate && selectedGw.endDate && Array.isArray(liveCard.scheduleGames)) {
          const s = new Date(selectedGw.startDate).getTime();
          const e = new Date(selectedGw.endDate).getTime();
          const gwGames = liveCard.scheduleGames.filter(g => g.timestamp >= s && g.timestamp <= e);
          const hasZeroDnp = gwGames.length > 0 && gwGames.every(g => g.alreadyPlayedScore === 0 && (g.alreadyPlayedMins === 0 || g.alreadyPlayedMins === null));
          if (hasZeroDnp) {
            alerts.push({
              presetId: preset.id,
              presetLabel: preset.label,
              playerName: liveCard.name,
              reason: '0 pt DNP nel match già disputato in questa GW'
            });
          }
        }
      });
    });

    return alerts;
  },

  injectFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚽</text></svg>';
    document.head.appendChild(link);
  },

  ensureBannerElement() {
    let banner = document.getElementById('status-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'status-banner';
      banner.className = 'status-banner';
      const mainContainer = document.querySelector('main') || document.body;
      mainContainer.insertBefore(banner, mainContainer.firstChild);
    }
  },

  sendToExtension(type, input = {}) {
    return new Promise((resolve) => {
      const reqId = 'sh_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const timeout = setTimeout(() => {
        window.removeEventListener('message', listener);
        resolve({ ok: false, error: 'Estensione Chrome non risponde: vai su chrome://extensions, clicca Ricarica su SorareHub Direct API e aggiorna questa pagina.' });
      }, 25000);

      function listener(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.__shSource !== 'ext' || data.reqId !== reqId) return;
        clearTimeout(timeout);
        window.removeEventListener('message', listener);
        resolve(data.resp || { ok: false, error: 'Nessuna risposta dal Service Worker.' });
      }

      window.addEventListener('message', listener);
      window.postMessage({ __shSource: 'page', type, reqId, input }, '*');
    });
  },

  buildSorareFixtureSlugFromDates(startDateInput, endDateInput) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const s = new Date(startDateInput);
    const e = new Date(endDateInput);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;

    const d1 = s.getUTCDate();
    const m1 = months[s.getUTCMonth()];
    const y1 = s.getUTCFullYear();
    const d2 = e.getUTCDate();
    const m2 = months[e.getUTCMonth()];
    const y2 = e.getUTCFullYear();

    if (m1 === m2 && y1 === y2) {
      return `football-${d1}-${d2}-${m1}-${y1}`;
    }
    if (y1 === y2) {
      return `football-${d1}-${m1}-${d2}-${m2}-${y1}`;
    }
    return `football-${d1}-${m1}-${y1}-${d2}-${m2}-${y2}`;
  },

  async syncRealSorareFixturesAndLineups() {
    const token = localStorage.getItem('sorare_access_token');
    if (!token) return false;

    const proxyUrl = (window.CONFIG && CONFIG.SORARE_GRAPHQL_PROXY) || 'https://sorarehub-oauth.matty-ciaroni.workers.dev/graphql';

    try {
      const listRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          query: '{ so5 { so5Fixtures(first: 8) { nodes { slug gameWeek startDate endDate aasmState } } } }'
        })
      });
      const listJson = await listRes.json();
      const rawNodes = listJson?.data?.so5?.so5Fixtures?.nodes || [];

      const dynamicSlugs = new Set();

      if (Array.isArray(this.gameweeks)) {
        this.gameweeks.forEach(gw => {
          const computedSlug = this.buildSorareFixtureSlugFromDates(gw.startDate, gw.endDate);
          if (computedSlug) dynamicSlugs.add(computedSlug);
        });
      }

      const sortedNodes = [...rawNodes]
        .filter(n => n && n.slug)
        .sort((a, b) => (a.gameWeek || 0) - (b.gameWeek || 0));

      sortedNodes.forEach(n => dynamicSlugs.add(n.slug));

      const slugList = Array.from(dynamicSlugs).slice(0, 6);
      if (slugList.length === 0) return false;

      const aliasQueries = slugList.map((s, idx) => `
        f${idx}: so5Fixture(slug: "${s}") {
          slug
          gameWeek
          startDate
          endDate
          so5Leaderboards {
            id
            slug
            displayName
            rarityType
            division
            mySo5Lineups {
              id
              name
              so5Appearances {
                captain
                anyCard {
                  slug
                }
              }
            }
          }
        }
      `).join('\n');

      const detailRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          query: `query GetRealSorareState { so5 { ${aliasQueries} } }`
        })
      });

      const detailJson = await detailRes.json();
      const so5Data = detailJson?.data?.so5 || {};

      const fixturesMap = {};
      const usedBySlug = {};
      const realFixturesArray = [];

      Object.keys(so5Data).forEach(aliasKey => {
        const fix = so5Data[aliasKey];
        if (!fix || !fix.slug) return;
        fixturesMap[fix.slug] = fix;
        realFixturesArray.push(fix);
        usedBySlug[fix.slug] = {};

        (fix.so5Leaderboards || []).forEach(lb => {
          (lb.mySo5Lineups || []).forEach(lu => {
            (lu.so5Appearances || []).forEach(app => {
              const cSlug = app?.anyCard?.slug;
              if (cSlug) {
                usedBySlug[fix.slug][cSlug] = {
                  cardSlug: cSlug,
                  leaderboardName: lb.displayName || lb.slug,
                  leaderboardSlug: lb.slug,
                  leaderboardId: lb.id,
                  lineupId: lu.id,
                  lineupName: lu.name || 'Formazione'
                };
              }
            });
          });
        });
      });

      this.sorareFixturesBySlug = fixturesMap;
      this.usedCardsByGwSlug = usedBySlug;

      realFixturesArray.sort((a, b) => (a.gameWeek || 0) - (b.gameWeek || 0));

      if (realFixturesArray.length > 0 && Array.isArray(this.gameweeks)) {
        this.gameweeks.forEach((gw, idx) => {
          const computedSlug = this.buildSorareFixtureSlugFromDates(gw.startDate, gw.endDate);
          const gwStart = gw.startDate ? new Date(gw.startDate).getTime() : 0;

          let matchedFix =
            (computedSlug && fixturesMap[computedSlug]) ||
            realFixturesArray.find(rf => {
              if (!rf.startDate) return false;
              const rfStart = new Date(rf.startDate).getTime();
              return Math.abs(rfStart - gwStart) <= 36 * 3600 * 1000;
            }) ||
            realFixturesArray[idx];

          if (matchedFix) {
            gw.gameWeek = matchedFix.gameWeek;
            gw.sorareSlug = matchedFix.slug;
            const isMidweek = gw.label && gw.label.toLowerCase().includes('midweek');
            gw.label = `GW #${matchedFix.gameWeek} (${isMidweek ? 'Midweek' : 'Weekend'})`;
          }
        });
      }

      return true;
    } catch (err) {
      console.warn('Errore syncRealSorareFixturesAndLineups:', err);
      return false;
    }
  },

  getSelectedSorareFixture() {
    const selectedGw = this.gameweeks[this.selectedGwIndex];
    if (selectedGw && selectedGw.sorareSlug && this.sorareFixturesBySlug[selectedGw.sorareSlug]) {
      return this.sorareFixturesBySlug[selectedGw.sorareSlug];
    }
    const allFixes = Object.values(this.sorareFixturesBySlug).sort((a, b) => (a.gameWeek || 0) - (b.gameWeek || 0));
    return allFixes[this.selectedGwIndex] || allFixes[0] || null;
  },

  getLockedCardsMapForCurrentGw() {
    const fix = this.getSelectedSorareFixture();
    if (!fix || !fix.slug) return {};
    return this.usedCardsByGwSlug[fix.slug] || {};
  },

  matchLeaderboardFromFixture(leaderboards, comp, scarcity, targetMode = 'standard') {
    if (!Array.isArray(leaderboards) || leaderboards.length === 0) return null;
    const targetRarity = String(scarcity || 'limited').toLowerCase();
    const compId = String(comp.id || '').toLowerCase();
    const isHotStreakMode = targetMode === 'hotstreak';

    const rarityFiltered = leaderboards.filter(lb => {
      const r = String(lb.rarityType || lb.slug || '').toLowerCase();
      if (targetRarity === 'super_rare') return r.includes('super_rare');
      if (targetRarity === 'rare') return r.includes('rare') && !r.includes('super_rare');
      return r.includes(targetRarity);
    });

    if (rarityFiltered.length === 0) return null;

    const nonArenaPool = rarityFiltered.filter(lb => {
      const s = String(lb.slug || '').toLowerCase();
      return !s.includes('_arena_');
    });

    const pool = nonArenaPool.length > 0 ? nonArenaPool : rarityFiltered;

    const exactSorareSlugTokens = {
      'premier_league_in_season': { primary: ['in_season_england_'], secondary: ['-england-'] },
      'serie_a_in_season': { primary: ['in_season_italy_'], secondary: ['-italy-'] },
      'laliga_in_season': { primary: ['in_season_spain_'], secondary: ['-spain-'] },
      'bundesliga_in_season': { primary: ['in_season_germany_'], secondary: ['-germany-'] },
      'ligue1_in_season': { primary: ['in_season_france_'], secondary: ['-france-'] },
      'championship_in_season': { primary: ['in_season_england_second_'], secondary: ['england_second', 'england_championship'] },
      'liga_portugal_in_season': { primary: ['in_season_portugal_'], secondary: ['-portugal-'] },
      'jupiler_in_season': { primary: ['in_season_jupiler_', 'in_season_belgium_'], secondary: ['-jupiler-', '-belgium-'] },
      'eredivisie_in_season': { primary: ['in_season_netherlands_'], secondary: ['-netherlands-'] },
      'scottish_in_season': { primary: ['in_season_scotland_'], secondary: ['-scotland-', 'spfl'] },
      'mls_in_season': { primary: ['in_season_us_'], secondary: ['-us-'] },
      'j1_league_in_season': { primary: ['in_season_japan_'], secondary: ['-japan-'] },
      'k_league_in_season': { primary: ['in_season_korea_'], secondary: ['-korea-'] },
      'contender_in_season': { primary: ['in_season_contenders', 'in_season_contender', '-contenders-'], secondary: ['contender'] },
      'champions_europe_classic_so7': { primary: ['champions_league', 'european_champions', 'ucl'], secondary: ['all_seasons_champions'] },
      'contender_europe_classic_so7': { primary: ['europa_league', 'contender_europe', 'uel'], secondary: ['all_seasons_contenders'] },
      'champion_europe_classic_so7': { primary: ['all_seasons_champions'], secondary: ['-champions-'] },
      'u23_classic_so7': { primary: ['all_seasons_under_twenty_one'], secondary: ['under_twenty_one', 'u23'] },
      'all_star_classic_so7': { primary: ['all_seasons_all_star'], secondary: ['-all_star-'] }
    };

    const mapping = exactSorareSlugTokens[compId] || {
      primary: [compId.replace(/_in_season|_classic_so7/g, '')],
      secondary: []
    };

    const isClassicSo7 = comp.format === 'SO7' || compId.includes('classic');

    const scored = pool.map(lb => {
      const s = String(lb.slug || '').toLowerCase();
      const dName = String(lb.displayName || '').toLowerCase();
      let score = 0;

      if (mapping.primary.some(k => k && (s.includes(k) || dName.includes(k)))) {
        score += 120;
      } else if (mapping.secondary.some(k => k && (s.includes(k) || dName.includes(k)))) {
        score += 75;
      }

      if (score === 0) return { lb, score: 0 };

      const lbIsClassic = s.includes('all_seasons');
      const lbIsInSeason = s.includes('in_season');
      const lbIsPveHotStreak = s.endsWith('_pve') || dName.includes('hot streak');
      const lbIsPvp = s.endsWith('_pvp');

      if (isClassicSo7 && lbIsClassic) score += 30;
      if (!isClassicSo7 && lbIsInSeason) score += 30;

      if (isHotStreakMode) {
        if (lbIsPveHotStreak) score += 60;
        else if (lbIsInSeason && !lbIsPvp) score += 25;
        else if (lbIsPvp) score -= 40;
      } else {
        if (lbIsPveHotStreak) score -= 60;
        if (lbIsPvp) score += 25;
      }

      if (lb.division === 1) score += 10;
      else if (typeof lb.division === 'number') score += Math.max(0, 6 - lb.division);

      return { lb, score };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0] ? scored[0].lb : null;
  },

  getProBoardConfigSlug(compId) {
    const proBoardSlugMap = {
      'scottish_in_season': 'football-pro-27-scotland',
      'liga_portugal_in_season': 'football-pro-27-portugal',
      'jupiler_in_season': 'football-pro-27-jupiler',
      'eredivisie_in_season': 'football-pro-27-netherlands',
      'premier_league_in_season': 'football-pro-27-england',
      'serie_a_in_season': 'football-pro-27-italy',
      'laliga_in_season': 'football-pro-27-spain',
      'bundesliga_in_season': 'football-pro-27-germany',
      'ligue1_in_season': 'football-pro-27-france',
      'championship_in_season': 'football-pro-27-england-second',
      'contender_in_season': 'football-pro-27-contender',
      'mls_in_season': 'football-pro-27-mls',
      'j1_league_in_season': 'football-pro-27-japan',
      'k_league_in_season': 'football-pro-27-korea'
    };
    return proBoardSlugMap[String(compId || '').toLowerCase()] || null;
  },

  async submitLineupDirectlyToSorare(lineupIndex, btnEl, targetMode = 'standard') {
    const lineup = this.lastGeneratedLineups[lineupIndex];
    if (!lineup || !Array.isArray(lineup.starters) || lineup.starters.length === 0) {
      this.notify('❌ Formazione non trovata.', true);
      return;
    }

    const modeLabel = targetMode === 'hotstreak' ? '🔥 Hot Streak PRO' : '⚡ Torneo';
    const originalText = btnEl ? btnEl.innerHTML : modeLabel;
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '⏳ Invio...';
    }
    this.notify(`⏳ Invio diretto di ${lineup.rankLabel} (${modeLabel}) a Sorare in corso...`);

    try {
      if (Object.keys(this.sorareFixturesBySlug).length === 0) {
        await this.syncRealSorareFixturesAndLineups();
      }

      const targetFixture = this.getSelectedSorareFixture();
      const selectedGw = this.gameweeks[this.selectedGwIndex] || null;
      const orderedStarters = this.sortStartersByCanonicalOrder(lineup.starters);
      const captainCard = orderedStarters.find(p => p.isCaptain) || orderedStarters[0];

      if (targetMode === 'hotstreak') {
        const configSlug = this.getProBoardConfigSlug(this.currentCompetition.id);
        if (!configSlug) {
          throw new Error(`La competizione "${this.currentCompetition.name}" non dispone di una Board Hot Streak PRO.`);
        }

        const startersPayload = orderedStarters.map((p) => {
          const firstMatch = (Array.isArray(p.gwMatches) && p.gwMatches[0]) || p.activeMatch || null;
          return {
            name: p.name,
            cardSlug: p.id,
            playerSlug: p.playerSlug,
            clubSlug: p.clubSlug,
            gameId: firstMatch?.id || firstMatch?.gameId || '',
            captain: Boolean(p.id === captainCard.id)
          };
        });

        const fromDate = selectedGw?.startDate
          ? new Date(new Date(selectedGw.startDate).getTime() - 12 * 3600 * 1000).toISOString()
          : targetFixture?.startDate;
        const toDate = selectedGw?.endDate
          ? new Date(new Date(selectedGw.endDate).getTime() + 24 * 3600 * 1000).toISOString()
          : targetFixture?.endDate;

        const proResp = await this.sendToExtension('SH_SUBMIT_PRO_HOTSTREAK', {
          configSlug,
          starters: startersPayload,
          fromDate,
          toDate
        });

        if (!proResp || !proResp.ok) {
          throw new Error(proResp?.error || 'Errore durante il salvataggio della formazione Hot Streak PRO.');
        }

        if (targetFixture && targetFixture.slug) {
          if (!this.usedCardsByGwSlug[targetFixture.slug]) {
            this.usedCardsByGwSlug[targetFixture.slug] = {};
          }
          orderedStarters.forEach(p => {
            this.usedCardsByGwSlug[targetFixture.slug][p.id] = {
              cardSlug: p.id,
              leaderboardName: `${this.currentCompetition.name} Hot Streak PRO`,
              leaderboardSlug: configSlug,
              leaderboardId: proResp.taskId || configSlug,
              lineupId: proResp.taskLineupId || 'pro',
              lineupName: lineup.rankLabel
            };
          });
        }

        this.runOptimizer();
        this.notify(`✅ ${lineup.rankLabel} schierata in 1-Click su Sorare Hot Streak PRO (${this.currentCompetition.name})!`);
        return;
      }

      if (!targetFixture || !Array.isArray(targetFixture.so5Leaderboards) || targetFixture.so5Leaderboards.length === 0) {
        throw new Error('Impossibile leggere i tornei della Gameweek da Sorare. Ricarica la pagina.');
      }

      const matchedLb = this.matchLeaderboardFromFixture(
        targetFixture.so5Leaderboards,
        this.currentCompetition,
        this.currentScarcity,
        'standard'
      );

      if (!matchedLb) {
        throw new Error(`Il torneo "${this.currentCompetition.name}" (${this.currentScarcity.toUpperCase()}) non è aperto su Sorare in ${targetFixture.slug}.`);
      }

      const appearancesClean = orderedStarters.map(p => ({
        cardSlug: p.id,
        captain: Boolean(p.id === captainCard.id)
      }));

      const startersMeta = orderedStarters.map(p => ({
        name: p.name,
        cardSlug: p.id,
        playerSlug: p.playerSlug,
        captain: Boolean(p.id === captainCard.id)
      }));

      const targetSorareUrl = `https://sorare.com/it/football/play/boards/${targetFixture.slug}`;

      const submitResp = await this.sendToExtension('SH_SUBMIT_LINEUP', {
        so5LeaderboardId: matchedLb.id,
        so5LeaderboardSlug: matchedLb.slug,
        name: lineup.rankLabel,
        so5Appearances: appearancesClean,
        startersMeta,
        targetUrl: targetSorareUrl
      });

      if (!submitResp || !submitResp.ok) {
        throw new Error(submitResp?.error || `Errore salvataggio su ${matchedLb.displayName || matchedLb.slug}`);
      }

      await this.syncRealSorareFixturesAndLineups();
      this.runOptimizer();
      this.notify(`✅ ${lineup.rankLabel} schierata con successo su Sorare in ${matchedLb.displayName || matchedLb.slug} (${modeLabel})!`);
    } catch (err) {
      console.error('Errore invio Sorare:', err);
      this.notify('❌ ' + err.message, true);
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalText;
      }
    }
  },

  updateGalleryCounters(lineupsCount = 0) {
    const total = this.cards.length;
    const inSeasonTotal = this.cards.filter(c => c.isInSeason).length;
    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;
    const lockedMap = this.getLockedCardsMapForCurrentGw();
    const presetReservedSet = this.getPresetReservedCardIdsSet();

    let confirmedXiCount = 0;
    const roleActiveCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const seenSlugs = new Set();

    this.cards.forEach(c => {
      if (this.isCardLockedInVault(c)) return;
      if (c.isInjuredOrSuspended && this.manualOverrides[c.playerSlug] !== 'xi') return;
      if (lockedMap[c.id] && !this.unlockedUsedCardSlugs.has(c.id)) return;
      if (presetReservedSet.has(c.id)) return;
      if (this.manualOverrides[c.playerSlug] === 'bench') return;
      if (c.scarcity !== this.currentScarcity) return;
      if (!OptimizerEngine.isCardEligibleForCompetition(c, this.currentCompetition, this.currentScarcity)) return;

      const games = Array.isArray(c.scheduleGames) ? c.scheduleGames : [];
      const validGames = games.filter(g => OptimizerEngine.isGameValidForCompetition(g, c, this.currentCompetition));
      let gwMatches = [];

      if (selectedGw && selectedGw.startDate && selectedGw.endDate) {
        const s = new Date(selectedGw.startDate).getTime();
        const e = new Date(selectedGw.endDate).getTime();
        gwMatches = validGames.filter(g =>
          g.timestamp >= s &&
          g.timestamp <= e &&
          OptimizerEngine.matchesAnytimeWindow(g, selectedGw, this.anytimeWindow)
        );
      }

      if (gwMatches.length > 0 && !seenSlugs.has(c.playerSlug)) {
        seenSlugs.add(c.playerSlug);
        confirmedXiCount++;
        if (roleActiveCounts[c.position] !== undefined) {
          roleActiveCounts[c.position]++;
        }
      }
    });

    const elTotal = document.getElementById('stat-total-cards');
    const elUser = document.getElementById('stat-user-slug');
    const elInSeason = document.getElementById('stat-inseason-cards');
    const elStarters = document.getElementById('stat-starters');
    const elBuilt = document.getElementById('stat-lineups-built');

    if (elTotal) elTotal.textContent = String(total);
    if (elUser) elUser.textContent = this.user?.nickname ? `Sincronizzato • @${this.user.nickname}` : 'Galleria Pro Attiva';
    if (elInSeason) elInSeason.textContent = String(inSeasonTotal);
    if (elStarters) elStarters.textContent = String(confirmedXiCount);
    if (elBuilt) elBuilt.textContent = String(lineupsCount);

    this.upgradeSecondaryInfoBoxes(selectedGw, roleActiveCounts);
  },

  upgradeSecondaryInfoBoxes(selectedGw, roleActiveCounts) {
    const rarityCards = this.cards.filter(c =>
      c.scarcity === this.currentScarcity &&
      !this.isCardLockedInVault(c) &&
      (!c.isInjuredOrSuspended || this.manualOverrides[c.playerSlug] === 'xi') &&
      OptimizerEngine.isCardEligibleForCompetition(c, this.currentCompetition, this.currentScarcity)
    );
    const isCount = rarityCards.filter(c => c.isInSeason).length;
    const classicCount = rarityCards.length - isCount;
    const injuredCount = this.cards.filter(c =>
      c.scarcity === this.currentScarcity &&
      c.isInjuredOrSuspended &&
      this.manualOverrides[c.playerSlug] !== 'xi'
    ).length;
    const vaultCount = this.cards.filter(c =>
      c.scarcity === this.currentScarcity &&
      this.isCardLockedInVault(c)
    ).length;

    const candidates = Array.from(document.querySelectorAll('div')).filter(el => {
      if (el.dataset.sorarehubHud === 'left' || el.dataset.sorarehubHud === 'right') return true;
      if (el.children.length > 2) return false;
      const txt = (el.textContent || '').trim();
      return txt === String(this.cards.length) || txt.startsWith('Connesso • @') || txt === 'Non connesso';
    });

    if (candidates.length >= 2) {
      const leftBox = candidates[0];
      const rightBox = candidates[1];
      leftBox.dataset.sorarehubHud = 'left';
      rightBox.dataset.sorarehubHud = 'right';

      leftBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;font-weight:800;color:#f3d266;text-transform:uppercase;letter-spacing:0.5px;">
              📡 Radar Giocatori Liberi in ${selectedGw ? selectedGw.label : 'GW Attiva'} (${selectedGw ? selectedGw.dateRangeText : ''})
            </div>
            <div style="font-size:12.5px;color:#e0e0e0;margin-top:4px;">
              Schierabili nella finestra attiva: <strong>GK: ${roleActiveCounts.GK}</strong> • <strong>DC: ${roleActiveCounts.DEF}</strong> • <strong>CC: ${roleActiveCounts.MID}</strong> • <strong>ATT: ${roleActiveCounts.FWD}</strong>
            </div>
          </div>
        </div>
      `;

      const vaultSubNote = vaultCount > 0 ? ` • <span style="color:#b0bec5;">🔐 ${vaultCount} Cassaforte</span>` : '';

      rightBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;font-weight:800;color:#64b5f6;text-transform:uppercase;letter-spacing:0.5px;">
              🃏 Rosa Eleggibile ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})
            </div>
            <div style="font-size:12.5px;color:#e0e0e0;margin-top:4px;">
              <strong>${isCount} In-Season (26/27)</strong> • <strong>${classicCount} Classic</strong> • <span style="color:#ff8a95;">🚑 ${injuredCount} Indisponibili</span>${vaultSubNote}
            </div>
          </div>
        </div>
      `;
    }
  },

  buildCollapsibleStripHtml(panelKey, stripClass, titleHtml, countBadgeText, bodyHtml) {
    const isOpen = this.openCollapsiblePanels.has(panelKey);
    const toggleBtnLabel = isOpen ? 'Chiudi ▴' : 'Mostra ▾';
    return `
      <div class="${stripClass} sh-collapsible-strip ${isOpen ? 'is-open' : ''}">
        <div class="sh-collapsible-head" data-toggle-panel="${this.escapeHtml(panelKey)}">
          <div class="sh-collapsible-title">
            ${titleHtml}
            <span class="sh-collapsible-count">${this.escapeHtml(countBadgeText)}</span>
          </div>
          <span class="sh-collapsible-toggle">${toggleBtnLabel}</span>
        </div>
        <div class="sh-collapsible-body" style="display:${isOpen ? 'block' : 'none'};">
          ${bodyHtml}
        </div>
      </div>
    `;
  },

  injectTacticalStyles() {
    if (document.getElementById('sorarehub-tactical-styles')) return;
    const style = document.createElement('style');
    style.id = 'sorarehub-tactical-styles';
    style.textContent = `
      .sh-account-popover {
        position: absolute;
        width: 215px;
        background: #141519;
        border: 1px solid rgba(212, 175, 55, 0.65);
        border-radius: 11px;
        padding: 8px;
        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.9);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .sh-account-header {
        font-size: 11px;
        color: #9aa0a6;
        padding: 4px 8px 6px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        margin-bottom: 2px;
      }
      .sh-account-header strong {
        color: #f3d266;
      }
      .sh-account-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid transparent;
        border-radius: 7px;
        padding: 8px 10px;
        color: #e0e0e0;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
      }
      .sh-account-item:hover {
        background: rgba(212, 175, 55, 0.14);
        border-color: rgba(212, 175, 55, 0.45);
        color: #f3d266;
      }
      .sh-account-item.logout {
        color: #ff8a95;
      }
      .sh-account-item.logout:hover {
        background: rgba(244, 67, 54, 0.18);
        border-color: rgba(244, 67, 54, 0.55);
        color: #ffcdd2;
      }
      #status-banner {
        display: none;
        width: 100%;
        max-width: 1400px;
        margin: 12px auto;
        padding: 11px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.4;
        box-sizing: border-box;
      }
      #status-banner.success {
        display: block;
        background: rgba(212, 175, 55, 0.14);
        border: 1px solid rgba(212, 175, 55, 0.55);
        color: #f3d266;
      }
      #status-banner.error {
        display: block;
        background: rgba(220, 53, 69, 0.16);
        border: 1px solid rgba(220, 53, 69, 0.65);
        color: #ff8a95;
      }
      #lineups-grid, #lineups-output, #sorarehub-horizontal-grid, .lineups-grid {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        gap: 20px !important;
        width: 100% !important;
        max-width: 1400px !important;
        margin: 18px auto !important;
        padding: 8px 14px 20px 14px !important;
        box-sizing: border-box !important;
        align-items: stretch !important;
      }
      .sh-lineup-card, .lineup-card {
        flex: 0 0 420px !important;
        min-width: 400px !important;
        max-width: 445px !important;
        background: #141519 !important;
        border: 1px solid rgba(212, 175, 55, 0.42) !important;
        border-radius: 14px !important;
        padding: 16px !important;
        color: #f0f0f0 !important;
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.55) !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
      }
      .sh-card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid rgba(255,255,255,0.09);
        padding-bottom: 10px;
        margin-bottom: 10px;
        gap: 8px;
      }
      .sh-rank { color: #f3d266; font-weight: 800; font-size: 16px; }
      .sh-comp { color: #9aa0a6; font-size: 12px; margin-top: 2px; }
      .sh-score { color: #f3d266; font-weight: 800; font-size: 21px; text-align: right; }
      .sh-target-pill {
        display: inline-block;
        margin-top: 4px;
        padding: 2px 7px;
        border-radius: 5px;
        font-size: 10px;
        font-weight: 800;
        text-align: right;
      }
      .sh-target-pill.target-pass {
        background: rgba(46, 125, 50, 0.28);
        border: 1px solid rgba(76, 175, 80, 0.65);
        color: #81c784;
      }
      .sh-target-pill.target-warn {
        background: rgba(255, 152, 0, 0.22);
        border: 1px solid rgba(255, 152, 0, 0.6);
        color: #ffb74d;
      }
      .sh-brand-watermark {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        color: #d4af37;
        background: rgba(212, 175, 55, 0.12);
        border: 1px solid rgba(212, 175, 55, 0.35);
        border-radius: 4px;
        padding: 2px 6px;
        margin-top: 4px;
      }
      .sh-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .sh-row:last-child { border-bottom: none; }
      .sh-pos {
        min-width: 44px;
        text-align: center;
        padding: 4px 5px;
        border-radius: 6px;
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: 0.4px;
        background: rgba(212, 175, 55, 0.18);
        color: #f3d266;
        border: 1px solid rgba(212, 175, 55, 0.35);
      }
      .sh-pos.pos-gk { background: rgba(255, 193, 7, 0.2); color: #ffd54f; }
      .sh-pos.pos-dc { background: rgba(76, 175, 80, 0.2); color: #81c784; }
      .sh-pos.pos-cc { background: rgba(33, 150, 243, 0.2); color: #64b5f6; }
      .sh-pos.pos-att { background: rgba(244, 67, 54, 0.2); color: #e57373; }
      .sh-pos.pos-extra { background: rgba(171, 71, 188, 0.2); color: #ce93d8; }
      .sh-avatar-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 42px;
        flex-shrink: 0;
      }
      .sh-avatar-ring {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        overflow: hidden;
        position: relative;
        background: radial-gradient(circle at 30% 30%, #2a2d37, #121318);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.65);
      }
      .sh-avatar-ring.ring-inseason { border: 2px solid #f3d266; }
      .sh-avatar-ring.ring-classic { border: 2px solid #90a4ae; }
      .sh-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
        display: block;
      }
      .sh-avatar-initials {
        font-size: 11px;
        font-weight: 800;
        color: #f3d266;
        letter-spacing: 0.4px;
      }
      .sh-avatar-tag {
        margin-top: -5px;
        z-index: 2;
        background: linear-gradient(135deg, #1b1d24 0%, #0d0e12 100%);
        border: 1px solid rgba(212, 175, 55, 0.65);
        color: #f3d266;
        font-size: 6.5px;
        font-weight: 900;
        letter-spacing: 0.45px;
        padding: 1px 4px;
        border-radius: 3px;
        text-transform: uppercase;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.8);
      }
      .sh-meta { flex: 1; min-width: 0; }
      .sh-name { font-weight: 700; font-size: 13.5px; color: #fff; line-height: 1.3; }
      .sh-sub { font-size: 11.5px; color: #b0b6be; margin-top: 3px; line-height: 1.35; }
      .sh-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
      .sh-pts { font-weight: 800; font-size: 14.5px; color: #f3d266; white-space: nowrap; }
      .sh-xi-btn {
        border-radius: 6px;
        padding: 3px 7px;
        font-size: 10.5px;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .sh-xi-btn.xi-confirmed {
        background: rgba(46, 125, 50, 0.28);
        border: 1px solid #4caf50;
        color: #81c784;
      }
      .sh-xi-btn.xi-rotation {
        background: rgba(255, 152, 0, 0.18);
        border: 1px solid rgba(255, 152, 0, 0.65);
        color: #ffb74d;
      }
      .sh-xi-btn:hover {
        background: rgba(244, 67, 54, 0.22);
        border-color: #ef5350;
        color: #ff8a95;
      }
      .sh-season-badge {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        margin-left: 4px;
        vertical-align: middle;
      }
      .sh-season-badge.in-season { background: rgba(212, 175, 55, 0.25); color: #f3d266; border: 1px solid rgba(212, 175, 55, 0.5); }
      .sh-season-badge.classic { background: rgba(255, 255, 255, 0.08); color: #9aa0a6; }
      .sh-season-badge.double-gw {
        background: rgba(255, 87, 34, 0.25);
        color: #ffab91;
        border: 1px solid rgba(255, 87, 34, 0.65);
      }
      .player-info-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-left: 5px;
        border-radius: 50%;
        background: rgba(212, 175, 55, 0.18);
        border: 1px solid rgba(212, 175, 55, 0.65);
        color: #f3d266;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        position: relative;
      }
      .tactical-tooltip-box {
        display: none;
        position: absolute;
        left: 0;
        top: calc(100% + 6px);
        width: 365px;
        max-width: 86vw;
        background: #0d0e12;
        border: 1px solid #d4af37;
        border-radius: 10px;
        padding: 12px 13px;
        color: #f0f0f0;
        font-size: 11.5px;
        font-weight: 400;
        line-height: 1.55;
        z-index: 9999;
        white-space: pre-line;
        box-shadow: 0 14px 32px rgba(0,0,0,0.92);
      }
      .player-info-trigger:hover .tactical-tooltip-box,
      .player-info-trigger.active .tactical-tooltip-box { display: block; }
      .sh-controls-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 9px;
        margin-top: 10px;
        width: 100%;
      }
      .gw-selector-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(212, 175, 55, 0.12);
        border: 1px solid rgba(212, 175, 55, 0.45);
        border-radius: 8px;
        padding: 6px 10px;
        color: #f3d266;
        font-size: 12px;
        font-weight: 600;
      }
      .gw-selector-pill select {
        background: #141519;
        color: #f3d266;
        border: 1px solid rgba(212, 175, 55, 0.4);
        border-radius: 5px;
        padding: 4px 6px;
        font-size: 12px;
        font-weight: 700;
      }
      .sh-strips-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        width: 100%;
        margin-top: 4px;
      }
      .sh-collapsible-strip {
        flex: 1 1 280px;
        border-radius: 9px;
        padding: 7px 11px;
        font-size: 12px;
        transition: all 0.15s ease;
        box-sizing: border-box;
      }
      .sh-collapsible-strip.is-open {
        flex: 1 1 100%;
      }
      .sh-collapsible-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
      }
      .sh-collapsible-title {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-weight: 700;
        flex-wrap: wrap;
      }
      .sh-collapsible-count {
        font-size: 10.5px;
        font-weight: 800;
        padding: 1px 7px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
      }
      .sh-collapsible-toggle {
        font-size: 11px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.32);
        border: 1px solid rgba(255, 255, 255, 0.18);
        white-space: nowrap;
      }
      .sh-collapsible-body {
        margin-top: 8px;
        padding-top: 7px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      .club-xi-strip {
        background: rgba(33, 150, 243, 0.09);
        border: 1px solid rgba(33, 150, 243, 0.38);
        color: #e0e0e0;
      }
      .benched-restore-strip {
        background: rgba(244, 67, 54, 0.1);
        border: 1px solid rgba(244, 67, 54, 0.42);
        color: #ffcdd2;
      }
      .sorare-locked-strip {
        background: rgba(156, 39, 176, 0.14);
        border: 1px solid rgba(186, 104, 200, 0.55);
        color: #f3e5f5;
      }
      .vault-locked-strip {
        background: rgba(96, 125, 139, 0.15);
        border: 1px solid rgba(144, 164, 174, 0.5);
        color: #cfd8dc;
      }
      .preset-alert-strip {
        width: 100%;
        background: rgba(211, 47, 47, 0.22);
        border: 1px solid rgba(244, 67, 54, 0.85);
        border-radius: 9px;
        padding: 8px 12px;
        margin-top: 6px;
        font-size: 12px;
        color: #ffcdd2;
      }
      .preset-active-strip {
        background: rgba(212, 175, 55, 0.12);
        border: 1px solid rgba(212, 175, 55, 0.55);
        color: #f3d266;
      }
      .club-xi-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin: 3px 4px 3px 0;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        border: 1px solid rgba(76, 175, 80, 0.55);
        background: rgba(76, 175, 80, 0.18);
        color: #a5d6a7;
      }
      .club-xi-chip.benched {
        border-color: rgba(244, 67, 54, 0.55);
        background: rgba(244, 67, 54, 0.18);
        color: #ef9a9a;
      }
      .club-xi-chip.locked-sorare {
        border-color: rgba(186, 104, 200, 0.65);
        background: rgba(156, 39, 176, 0.28);
        color: #f3e5f5;
      }
      .club-xi-chip.locked-vault {
        border-color: rgba(144, 164, 174, 0.65);
        background: rgba(96, 125, 139, 0.28);
        color: #eceff1;
      }
      .sh-direct-submit-footer {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(212, 175, 55, 0.22);
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .sh-direct-submit-btn {
        flex: 1;
        min-width: 115px;
        background: linear-gradient(135deg, #f3d266 0%, #d4af37 100%);
        color: #0d0e12;
        border: none;
        border-radius: 9px;
        padding: 9px 9px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: transform 0.12s ease, opacity 0.15s ease;
      }
      .sh-direct-submit-btn.hotstreak-btn {
        background: linear-gradient(135deg, #ff7043 0%, #d84315 100%);
        color: #ffffff;
      }
      .sh-direct-submit-btn.preset-btn {
        flex: 0 0 auto;
        min-width: auto;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(212, 175, 55, 0.5);
        color: #f3d266;
        padding: 9px 10px;
      }
      .sh-direct-submit-btn:hover {
        transform: translateY(-1px);
        opacity: 0.95;
      }
      .sh-direct-submit-btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }
    `;
    document.head.appendChild(style);
  },

  getCompetitionSelectEl() {
    const customIds = new Set(['gw-select', 'club-stack-select', 'target-threshold-select', 'anytime-window-select', 'portfolio-mode-select']);
    return (
      document.getElementById('comp-select') ||
      document.getElementById('competition-select') ||
      document.getElementById('tournament-select') ||
      Array.from(document.querySelectorAll('select')).find(s => !customIds.has(s.id))
    );
  },

  syncStateFromDOM() {
    const compSelect = this.getCompetitionSelectEl();
    if (compSelect && compSelect.value && window.CONFIG?.OFFICIAL_COMPETITIONS) {
      const found = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === compSelect.value);
      if (found) this.currentCompetition = found;
    }

    const activeRarityBtn = document.querySelector('[data-scarcity].active, [data-rarity].active');
    if (activeRarityBtn) {
      const r = (activeRarityBtn.dataset.scarcity || activeRarityBtn.dataset.rarity || '').toLowerCase();
      if (r) this.currentScarcity = r;
    }

    const activeStratBtn = document.querySelector('[data-strategy].active');
    if (activeStratBtn) {
      const s = (activeStratBtn.dataset.strategy || '').toLowerCase();
      if (s) this.currentStrategy = s;
    }
  },

  renderGwAndClubSelectors() {
    if (!this.gameweeks || this.gameweeks.length === 0) return;

    let container = document.getElementById('gw-selector-container');
    if (!container) {
      const controlDeck = document.querySelector('.control-deck') || this.getCompetitionSelectEl()?.parentElement;
      if (!controlDeck) return;
      container = document.createElement('div');
      container.id = 'gw-selector-container';
      container.className = 'sh-controls-bar';
      controlDeck.appendChild(container);
    }

    const gwOptionsHtml = this.gameweeks
      .map((gw, idx) => `<option value="${idx}" ${idx === this.selectedGwIndex ? 'selected' : ''}>${gw.label} • ${gw.dateRangeText}</option>`)
      .join('');

    const nonVaultCards = this.cards.filter(c => !this.isCardLockedInVault(c));

    const availableClubs = OptimizerEngine.getAvailableClubsForCompetition(
      nonVaultCards,
      this.currentCompetition,
      this.currentScarcity,
      this.manualOverrides
    );

    if (this.selectedClubSlug !== 'ALL' && !availableClubs.some(cl => cl.slug === this.selectedClubSlug)) {
      this.selectedClubSlug = 'ALL';
    }

    const clubOptionsHtml = [
      `<option value="ALL" ${this.selectedClubSlug === 'ALL' ? 'selected' : ''}>Tutte le squadre (Misto)</option>`,
      ...availableClubs.map(cl => {
        const fullTag = cl.roles.size >= 4 ? '★ Stack Completo' : `${cl.roles.size}/4 ruoli`;
        return `<option value="${this.escapeHtml(cl.slug)}" ${cl.slug === this.selectedClubSlug ? 'selected' : ''}>${this.escapeHtml(cl.name)} (${cl.count} carte • ${fullTag})</option>`;
      })
    ].join('');

    const thresholdOptions = [
      { val: 0, label: 'Libera (Usa Floor/Ceiling)' },
      { val: 260, label: '260 pt (Step 1 • Floor)' },
      { val: 300, label: '300 pt (Step 2 • Equilibrata)' },
      { val: 340, label: '340 pt (Step 3 • Spinta)' },
      { val: 380, label: '380 pt (Step 4 • Ceiling)' },
      { val: 420, label: '420+ pt (All-In Ceiling)' }
    ];
    const thresholdOptionsHtml = thresholdOptions
      .map(opt => `<option value="${opt.val}" ${Number(this.targetThreshold) === opt.val ? 'selected' : ''}>${opt.label}</option>`)
      .join('');

    const anytimeOptions = [
      { val: 'ALL', label: 'Tutte le gare GW' },
      { val: 'NOT_STARTED', label: 'Solo non ancora iniziate' },
      { val: 'TODAY', label: 'Solo partite di Oggi' },
      { val: 'TOMORROW', label: 'Solo partite di Domani' },
      { val: 'LATE_GW', label: 'Solo Posticipi / Ultime gare GW' }
    ];
    const anytimeOptionsHtml = anytimeOptions
      .map(opt => `<option value="${opt.val}" ${this.anytimeWindow === opt.val ? 'selected' : ''}>${opt.label}</option>`)
      .join('');

    const portfolioModeHtml = `
      <option value="cascade" ${this.portfolioMode === 'cascade' ? 'selected' : ''}>Cascata Classica (4+1)</option>
      <option value="four_lives" ${this.portfolioMode === 'four_lives' ? 'selected' : ''}>Piano 4 Vite (Multi-Stack)</option>
    `;

    let presetAlertsHtml = '';
    const dnpAlerts = this.evaluatePresetDnpAlerts();
    if (dnpAlerts.length > 0) {
      const alertLines = dnpAlerts.map(a =>
        `<div>⚠️ <strong>${this.escapeHtml(a.playerName)}</strong> in <em>${this.escapeHtml(a.presetLabel)}</em>: ${this.escapeHtml(a.reason)}</div>`
      ).join('');
      presetAlertsHtml = `
        <div class="preset-alert-strip">
          <strong>🚨 ALERT DNP / INDISPONIBILI SU PRE-SET SALVATI:</strong>
          ${alertLines}
        </div>
      `;
    }

    const collapsiblePanelsHtmlList = [];

    if (this.presetLineups.length > 0) {
      const presetChips = this.presetLineups.map(pr =>
        `<span class="club-xi-chip" data-remove-preset="${this.escapeHtml(pr.id)}" title="Clicca per sbloccare e rimuovere questo Pre-Set">📌 ${this.escapeHtml(pr.label)} (${pr.totalProjected} pt) ✕</span>`
      ).join('');
      const bodyHtml = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
          <span>Carte riservate escluse dal calcolo successivo:</span>
          <span class="club-xi-chip benched" data-clear-all-presets="1">Svuota tutti ✕</span>
        </div>
        <div>${presetChips}</div>
      `;
      collapsiblePanelsHtmlList.push(
        this.buildCollapsibleStripHtml('presets', 'preset-active-strip', '📌 Pre-Set Step Fissati', `${this.presetLineups.length} attivi`, bodyHtml)
      );
    }

    if (this.selectedClubSlug && this.selectedClubSlug !== 'ALL') {
      const clubCards = nonVaultCards.filter(c =>
        c.scarcity === this.currentScarcity &&
        c.clubSlug === this.selectedClubSlug &&
        (!c.isInjuredOrSuspended || this.manualOverrides[c.playerSlug] === 'xi')
      );
      const xiSlugs = OptimizerEngine.getClubStartingXiPool(clubCards, this.manualOverrides);
      const uniqueClubPlayers = [];
      const seen = new Set();
      clubCards.forEach(c => {
        if (!seen.has(c.playerSlug)) {
          seen.add(c.playerSlug);
          uniqueClubPlayers.push(c);
        }
      });

      const chips = uniqueClubPlayers.map(p => {
        const isBench = this.manualOverrides[p.playerSlug] === 'bench' || !xiSlugs.has(p.playerSlug);
        const cls = isBench ? 'club-xi-chip benched' : 'club-xi-chip';
        const icon = isBench ? '🪑' : '✅';
        return `<span class="${cls}" data-club-xi-slug="${this.escapeHtml(p.playerSlug)}" title="Clicca per confermare nell'11 titolare o spostare in panchina">${icon} ${this.escapeHtml(p.position)}: ${this.escapeHtml(p.name)}</span>`;
      }).join('');

      collapsiblePanelsHtmlList.push(
        this.buildCollapsibleStripHtml(
          'club_xi',
          'club-xi-strip',
          `🎯 11 Titolari ${this.escapeHtml(uniqueClubPlayers[0]?.club || '')}`,
          `${uniqueClubPlayers.length} giocatori`,
          `<div>Verde = Titolare XI (✅) • Rosso = Riserva/Panchina (🪑):</div><div style="margin-top:4px;">${chips}</div>`
        )
      );
    }

    const lockedMap = this.getLockedCardsMapForCurrentGw();
    const lockedEntries = Object.values(lockedMap).filter(entry => {
      const foundCard = this.cards.find(c => c.id === entry.cardSlug);
      return !foundCard || foundCard.scarcity === this.currentScarcity;
    });

    if (lockedEntries.length > 0) {
      const lockedChips = lockedEntries.map(entry => {
        const foundCard = this.cards.find(c => c.id === entry.cardSlug);
        const pName = foundCard ? foundCard.name : entry.cardSlug;
        const isUnlockedManually = this.unlockedUsedCardSlugs.has(entry.cardSlug);
        const chipCls = isUnlockedManually ? 'club-xi-chip' : 'club-xi-chip locked-sorare';
        const statusIcon = isUnlockedManually ? '🔓 Riusa:' : '🔒';
        return `<span class="${chipCls}" data-toggle-sorare-lock="${this.escapeHtml(entry.cardSlug)}" title="Schierato in ${this.escapeHtml(entry.leaderboardName)} (${this.escapeHtml(entry.lineupName)}). Clicca se vuoi sbloccarlo e riusarlo comunque.">${statusIcon} ${this.escapeHtml(pName)} (${this.escapeHtml(entry.leaderboardName)})</span>`;
      }).join('');

      collapsiblePanelsHtmlList.push(
        this.buildCollapsibleStripHtml(
          'locked_sorare',
          'sorare-locked-strip',
          '🔒 Già schierate su Sorare in questa GW',
          `${lockedEntries.length} carte`,
          `<div>Escluse in automatico (clicca su una carta per sbloccarla temporaneamente):</div><div style="margin-top:4px;">${lockedChips}</div>`
        )
      );
    }

    const benchedSlugs = Object.keys(this.manualOverrides).filter(slug => this.manualOverrides[slug] === 'bench');
    const autoFilteredLongTerm = [];
    const seenLongTerm = new Set();
    this.cards.forEach(c => {
      if (
        c.scarcity === this.currentScarcity &&
        !this.isCardLockedInVault(c) &&
        c.isInferredLongTermInactive &&
        this.manualOverrides[c.playerSlug] !== 'xi' &&
        !seenLongTerm.has(c.playerSlug) &&
        OptimizerEngine.isCardEligibleForCompetition(c, this.currentCompetition, this.currentScarcity)
      ) {
        seenLongTerm.add(c.playerSlug);
        autoFilteredLongTerm.push(c);
      }
    });

    const totalExcludedCount = benchedSlugs.length + autoFilteredLongTerm.length;
    if (totalExcludedCount > 0) {
      const manualChips = benchedSlugs.map(slug => {
        const foundCard = this.cards.find(c => c.playerSlug === slug);
        const pName = foundCard ? foundCard.name : slug;
        return `<span class="club-xi-chip benched" data-restore-slug="${this.escapeHtml(slug)}" title="Clicca per rimettere subito tra i Titolari XI">🪑 ${this.escapeHtml(pName)} (Ripristina XI ↩)</span>`;
      });

      const autoLongTermChips = autoFilteredLongTerm.map(c => {
        return `<span class="club-xi-chip benched" data-restore-slug="${this.escapeHtml(c.playerSlug)}" title="${this.escapeHtml(c.baseUnavailableReason)} — Clicca se il giocatore è tornato disponibile">🚑 ${this.escapeHtml(c.name)} (${this.escapeHtml(c.club)} • Forza XI ↩)</span>`;
      });

      collapsiblePanelsHtmlList.push(
        this.buildCollapsibleStripHtml(
          'excluded_longterm',
          'benched-restore-strip',
          '🚑 / 🪑 Esclusi & Lungodegenti',
          `${totalExcludedCount} esclusi`,
          `<div>Clicca su un giocatore se è tornato disponibile e vuoi forzarlo nell'11 titolare:</div><div style="margin-top:4px;">${[...manualChips, ...autoLongTermChips].join('')}</div>`
        )
      );
    }

    const vaultCards = this.cards.filter(c =>
      c.scarcity === this.currentScarcity &&
      Boolean(c.isSealedInVault) &&
      OptimizerEngine.isCardEligibleForCompetition(c, this.currentCompetition, this.currentScarcity)
    );

    if (vaultCards.length > 0) {
      const vaultChips = vaultCards.map(c => {
        const isUnlocked = this.unlockedVaultCardIds.has(c.id);
        const cls = isUnlocked ? 'club-xi-chip' : 'club-xi-chip locked-vault';
        const icon = isUnlocked ? '🔓 Includi:' : '🔐 Cassaforte:';
        const seasonLabel = c.isInSeason ? '26/27' : 'Classic';
        return `<span class="${cls}" data-toggle-vault-card="${this.escapeHtml(c.id)}" title="Carta in Cassaforte su Sorare. Clicca se l'hai appena sbloccata e vuoi includerla nel calcolo.">${icon} ${this.escapeHtml(c.name)} (${this.escapeHtml(c.club)} • ${seasonLabel})</span>`;
      }).join('');

      collapsiblePanelsHtmlList.push(
        this.buildCollapsibleStripHtml(
          'vault_cards',
          'vault-locked-strip',
          '🔐 Carte in Cassaforte (Vault Sorare)',
          `${vaultCards.length} carte`,
          `<div>Escluse automaticamente dal calcolo (clicca su una carta se l'hai sbloccata su Sorare):</div><div style="margin-top:4px;">${vaultChips}</div>`
        )
      );
    }

    const stripsGridHtml = collapsiblePanelsHtmlList.length > 0
      ? `<div class="sh-strips-grid">${collapsiblePanelsHtmlList.join('')}</div>`
      : '';

    container.innerHTML = `
      <div class="gw-selector-pill">
        <span>📅 GW:</span>
        <select id="gw-select">${gwOptionsHtml}</select>
      </div>
      <div class="gw-selector-pill">
        <span>🎯 Soglia:</span>
        <select id="target-threshold-select">${thresholdOptionsHtml}</select>
      </div>
      <div class="gw-selector-pill">
        <span>⏱️ Anytime:</span>
        <select id="anytime-window-select">${anytimeOptionsHtml}</select>
      </div>
      <div class="gw-selector-pill">
        <span>🃏 Piano:</span>
        <select id="portfolio-mode-select">${portfolioModeHtml}</select>
      </div>
      <div class="gw-selector-pill">
        <span>🏟️ Club:</span>
        <select id="club-stack-select">${clubOptionsHtml}</select>
      </div>
      ${presetAlertsHtml}
      ${stripsGridHtml}
    `;

    const gwSelect = document.getElementById('gw-select');
    if (gwSelect) {
      gwSelect.addEventListener('change', (e) => {
        this.selectedGwIndex = Number(e.target.value) || 0;
        this.runOptimizer();
      });
    }

    const thresholdSelect = document.getElementById('target-threshold-select');
    if (thresholdSelect) {
      thresholdSelect.addEventListener('change', (e) => {
        this.targetThreshold = Number(e.target.value) || 0;
        this.runOptimizer();
      });
    }

    const anytimeSelect = document.getElementById('anytime-window-select');
    if (anytimeSelect) {
      anytimeSelect.addEventListener('change', (e) => {
        this.anytimeWindow = e.target.value || 'ALL';
        this.runOptimizer();
      });
    }

    const modeSelect = document.getElementById('portfolio-mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.portfolioMode = e.target.value || 'cascade';
        this.runOptimizer();
      });
    }

    const clubSelect = document.getElementById('club-stack-select');
    if (clubSelect) {
      clubSelect.addEventListener('change', (e) => {
        this.selectedClubSlug = e.target.value || 'ALL';
        this.runOptimizer();
      });
    }
  },

  async loadUserGallery(forceRefresh = false) {
    if (this.isLoggingOut) return;
    sessionStorage.removeItem(this.LOGOUT_FLAG_KEY);

    const loginBtn = document.getElementById('login-btn') || document.getElementById('connect-btn');
    const loginBtnText = document.getElementById('login-btn-text') || loginBtn;

    if (loginBtn) loginBtn.disabled = true;
    if (loginBtnText) loginBtnText.textContent = '⏳ Sincronizzazione...';
    this.notify('⏳ Connessione a Sorare e lettura formazioni schierate in corso...');

    try {
      const data = await SorareAPI.fetchCurrentUserGallery(forceRefresh);
      if (data && data.cards) {
        this.user = data.user;
        this.cards = data.cards;
        this.gameweeks = data.gameweeks || [];
        this.selectedGwIndex = 0;

        if (loginBtnText) {
          loginBtnText.textContent = `✅ @${this.user?.nickname || 'Manager'} (${this.cards.length} carte) ▾`;
        }
        if (loginBtn) {
          loginBtn.classList.add('connected');
          loginBtn.disabled = false;
        }

        await this.syncRealSorareFixturesAndLineups();

        this.syncStateFromDOM();
        this.renderGwAndClubSelectors();
        this.runOptimizer();
      }
    } catch (err) {
      console.error('Errore fetch galleria:', err);
      if (loginBtn) loginBtn.disabled = false;
      if (loginBtnText) loginBtnText.textContent = 'Connetti Sorare';
      if (String(err.message || '').toLowerCase().includes('unauthorized') || String(err.message || '').toLowerCase().includes('invalid token')) {
        localStorage.removeItem('sorare_access_token');
        this.notify('🔄 Sessione OAuth scaduta: clicca di nuovo su "Connetti Sorare" in alto a destra.', true);
      } else {
        this.notify('❌ Errore caricamento: ' + err.message, true);
      }
    }
  },

  populateCompetitionDropdown() {
    const select = this.getCompetitionSelectEl();
    if (!select || !window.CONFIG?.OFFICIAL_COMPETITIONS) return;

    select.innerHTML = CONFIG.OFFICIAL_COMPETITIONS.map(comp => {
      const badge = comp.format === 'SO7' ? '[SO7 Classic]' : '[SO5 In-Season]';
      return `<option value="${comp.id}">${badge} ${comp.name}</option>`;
    }).join('');
  },

  bindEvents() {
    let loginBtn = document.getElementById('login-btn') || document.getElementById('connect-btn');
    if (loginBtn) {
      // Rimuove qualsiasi onclick inline o vecchio listener duplicato
      loginBtn.removeAttribute('onclick');
      const cleanBtn = loginBtn.cloneNode(true);
      cleanBtn.removeAttribute('onclick');
      if (loginBtn.parentNode) {
        loginBtn.parentNode.replaceChild(cleanBtn, loginBtn);
      }
      loginBtn = cleanBtn;

      loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isConnected = Boolean(localStorage.getItem('sorare_access_token')) || Boolean(this.user) || (this.cards && this.cards.length > 0);
        if (isConnected) {
          this.toggleAccountMenu(loginBtn);
        } else {
          sessionStorage.removeItem(this.LOGOUT_FLAG_KEY);
          if (window.SorareAPI && SorareAPI.__rawStartOAuth) {
            SorareAPI.__rawStartOAuth();
          } else {
            SorareAPI.startOAuthFlow();
          }
        }
      });
    }

    const compSelect = this.getCompetitionSelectEl();
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        const found = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === e.target.value);
        if (found) {
          this.currentCompetition = found;
          this.selectedClubSlug = 'ALL';
          this.renderGwAndClubSelectors();
          this.runOptimizer();
        }
      });
    }

    document.querySelectorAll('[data-scarcity], [data-rarity]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const val = (target.dataset.scarcity || target.dataset.rarity || '').toLowerCase();
        if (!val) return;
        if (target.parentElement) {
          target.parentElement.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
        }
        target.classList.add('active');
        this.currentScarcity = val;
        this.selectedClubSlug = 'ALL';
        this.renderGwAndClubSelectors();
        this.runOptimizer();
      });
    });

    document.querySelectorAll('[data-strategy]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const val = (target.dataset.strategy || '').toLowerCase();
        if (!val) return;
        if (target.parentElement) {
          target.parentElement.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
        }
        target.classList.add('active');
        this.currentStrategy = val;
        this.targetThreshold = 0;
        this.runOptimizer();
      });
    });

    document.addEventListener('click', (e) => {
      const existingPopover = document.getElementById('sh-account-popover');
      if (existingPopover && !e.target.closest('#sh-account-popover') && !e.target.closest('#login-btn') && !e.target.closest('#connect-btn')) {
        existingPopover.remove();
      }

      const togglePanelHead = e.target.closest('[data-toggle-panel]');
      if (togglePanelHead) {
        e.stopPropagation();
        const key = togglePanelHead.dataset.togglePanel;
        if (key) {
          if (this.openCollapsiblePanels.has(key)) {
            this.openCollapsiblePanels.delete(key);
          } else {
            this.openCollapsiblePanels.add(key);
          }
          this.renderGwAndClubSelectors();
        }
        return;
      }

      const toggleVaultChip = e.target.closest('[data-toggle-vault-card]');
      if (toggleVaultChip) {
        e.stopPropagation();
        const cardId = toggleVaultChip.dataset.toggleVaultCard;
        if (cardId) {
          if (this.unlockedVaultCardIds.has(cardId)) {
            this.unlockedVaultCardIds.delete(cardId);
          } else {
            this.unlockedVaultCardIds.add(cardId);
          }
          this.runOptimizer();
        }
        return;
      }

      const pinPresetBtn = e.target.closest('[data-pin-preset-idx]');
      if (pinPresetBtn) {
        e.stopPropagation();
        const idx = Number(pinPresetBtn.dataset.pinPresetIdx);
        if (!Number.isNaN(idx)) this.pinLineupAsPreset(idx);
        return;
      }

      const removePresetChip = e.target.closest('[data-remove-preset]');
      if (removePresetChip) {
        e.stopPropagation();
        const pId = removePresetChip.dataset.removePreset;
        if (pId) this.removePreset(pId);
        return;
      }

      const clearAllPresetsBtn = e.target.closest('[data-clear-all-presets]');
      if (clearAllPresetsBtn) {
        e.stopPropagation();
        this.clearAllPresets();
        return;
      }

      const directSubmitBtn = e.target.closest('[data-direct-submit-idx]');
      if (directSubmitBtn) {
        e.stopPropagation();
        const idx = Number(directSubmitBtn.dataset.directSubmitIdx);
        const mode = directSubmitBtn.dataset.submitMode || 'standard';
        if (!Number.isNaN(idx)) {
          this.submitLineupDirectlyToSorare(idx, directSubmitBtn, mode);
        }
        return;
      }

      const toggleLockChip = e.target.closest('[data-toggle-sorare-lock]');
      if (toggleLockChip) {
        e.stopPropagation();
        const cardSlug = toggleLockChip.dataset.toggleSorareLock;
        if (cardSlug) {
          if (this.unlockedUsedCardSlugs.has(cardSlug)) {
            this.unlockedUsedCardSlugs.delete(cardSlug);
          } else {
            this.unlockedUsedCardSlugs.add(cardSlug);
          }
          this.runOptimizer();
        }
        return;
      }

      const restoreChip = e.target.closest('[data-restore-slug]');
      if (restoreChip) {
        e.stopPropagation();
        const slug = restoreChip.dataset.restoreSlug;
        if (slug) {
          this.manualOverrides[slug] = 'xi';
          this.runOptimizer();
        }
        return;
      }

      const clubXiChip = e.target.closest('[data-club-xi-slug]');
      if (clubXiChip) {
        e.stopPropagation();
        const slug = clubXiChip.dataset.clubXiSlug;
        if (slug) {
          this.manualOverrides[slug] = this.manualOverrides[slug] === 'bench' ? 'xi' : 'bench';
          this.runOptimizer();
        }
        return;
      }

      const xiBtn = e.target.closest('.sh-xi-btn');
      if (xiBtn) {
        e.stopPropagation();
        const slug = xiBtn.dataset.slug;
        if (slug) {
          this.manualOverrides[slug] = 'bench';
          this.runOptimizer();
        }
        return;
      }

      const trigger = e.target.closest('.player-info-trigger');
      if (trigger) {
        e.stopPropagation();
        const wasActive = trigger.classList.contains('active');
        document.querySelectorAll('.player-info-trigger.active').forEach(el => el.classList.remove('active'));
        if (!wasActive) trigger.classList.add('active');
        return;
      }

      if (!e.target.closest('.tactical-tooltip-box')) {
        document.querySelectorAll('.player-info-trigger.active').forEach(el => el.classList.remove('active'));
      }

      const btn = e.target.closest('button');
      if (btn && btn.id !== 'login-btn' && btn.id !== 'connect-btn' && !btn.closest('#sh-account-popover') && !btn.hasAttribute('data-direct-submit-idx') && !btn.hasAttribute('data-pin-preset-idx')) {
        const txt = (btn.textContent || '').toLowerCase();
        if (txt.includes('genera') || txt.includes('ottimizz') || txt.includes('calcola') || btn.id === 'generate-btn' || btn.id === 'optimize-btn' || btn.id === 'run-optimizer-btn') {
          this.syncStateFromDOM();
          this.runOptimizer();
        }
      }
    });
  },

  sortStartersByCanonicalOrder(starters) {
    const orderWeight = {
      'GK': 1,
      'DEF': 2,
      'DC': 2,
      'MID': 3,
      'CC': 3,
      'FWD': 4,
      'ATT': 4,
      'EXTRA': 5
    };
    const labelMap = {
      'GK': 'GK',
      'DEF': 'DC',
      'DC': 'DC',
      'MID': 'CC',
      'CC': 'CC',
      'FWD': 'ATT',
      'ATT': 'ATT',
      'EXTRA': 'EXTRA'
    };

    return [...(starters || [])]
      .sort((a, b) => (orderWeight[a.slotRole] || 9) - (orderWeight[b.slotRole] || 9))
      .map(p => ({
        ...p,
        displayRole: labelMap[p.slotRole] || p.slotRole
      }));
  },

  getInitials(name) {
    const parts = String(name || 'SH').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  buildCustomAvatarHtml(player) {
    const ringCls = player.isInSeason ? 'ring-inseason' : 'ring-classic';
    const initials = this.escapeHtml(this.getInitials(player.name));
    const imgUrl = player.avatarUrl || player.pictureUrl || '';

    const innerVisual = imgUrl
      ? `<img src="${this.escapeHtml(imgUrl)}" alt="${this.escapeHtml(player.name)}" class="sh-avatar-img" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
         <span class="sh-avatar-initials" style="display:none;">${initials}</span>`
      : `<span class="sh-avatar-initials">${initials}</span>`;

    return `
      <div class="sh-avatar-box" title="${this.escapeHtml(player.name)} • SorareHub Verified">
        <div class="sh-avatar-ring ${ringCls}">
          ${innerVisual}
        </div>
        <span class="sh-avatar-tag">SORAREHUB</span>
      </div>
    `;
  },

  runOptimizer() {
    if (!this.cards || this.cards.length === 0) {
      this.notify('⚠️ Nessuna carta sincronizzata: clicca su Connetti Sorare.', true);
      return;
    }

    this.syncStateFromDOM();
    this.renderGwAndClubSelectors();
    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;

    const lockedMap = this.getLockedCardsMapForCurrentGw();
    const presetReservedSet = this.getPresetReservedCardIdsSet();

    const availableCardsForGw = this.cards.filter(c => {
      if (this.isCardLockedInVault(c)) {
        return false;
      }
      if (lockedMap[c.id] && !this.unlockedUsedCardSlugs.has(c.id)) {
        return false;
      }
      if (presetReservedSet.has(c.id)) {
        return false;
      }
      return true;
    });

    const lineups = window.OptimizerEngine
      ? OptimizerEngine.buildCascadePortfolio(
          availableCardsForGw,
          this.currentCompetition,
          this.currentScarcity,
          this.currentStrategy,
          selectedGw,
          this.manualOverrides,
          this.selectedClubSlug,
          {
            targetThreshold: this.targetThreshold,
            anytimeWindow: this.anytimeWindow,
            portfolioMode: this.portfolioMode
          }
        )
      : [];

    this.lastGeneratedLineups = lineups;
    this.updateGalleryCounters(lineups.length);
    this.renderLineups(lineups, selectedGw);
  },

  renderLineups(lineups, selectedGw) {
    const existingGrid =
      document.getElementById('lineups-output') ||
      document.getElementById('lineups-grid') ||
      document.getElementById('lineups-container') ||
      document.getElementById('results-grid') ||
      document.querySelector('.lineups-grid');

    let targetGrid = existingGrid;
    if (!targetGrid) {
      targetGrid = document.getElementById('sorarehub-horizontal-grid');
      if (!targetGrid) {
        targetGrid = document.createElement('div');
        targetGrid.id = 'sorarehub-horizontal-grid';
        const mainEl = document.querySelector('main') || document.body;
        mainEl.appendChild(targetGrid);
      }
    }

    const gwInfoStr = selectedGw ? ` • ${selectedGw.label} (${selectedGw.dateRangeText})` : '';
    const isStack = this.selectedClubSlug && this.selectedClubSlug !== 'ALL';

    if (!lineups || lineups.length === 0) {
      const reason = this.anytimeWindow !== 'ALL'
        ? `Nessuna formazione completa trovata nella finestra temporale selezionata (${this.anytimeWindow}). Prova a rimettere "Tutte le gare GW".`
        : (isStack
          ? `Non hai tutti i ruoli (GK, DC, CC, ATT) tra i giocatori liberi di questo club (o mancano le ${this.currentCompetition.inSeasonRequired || 0}/5 In-Season).`
          : `Non possiedi abbastanza carte libere ${this.currentCompetition.inSeasonRequired > 0 ? `In-Season 26/27 (richieste ${this.currentCompetition.inSeasonRequired}/5)` : ''} appartenenti ai club di ${this.currentCompetition.name}.`);
      const msg = `⚠️ 0 formazioni per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr} — ${reason}`;
      this.notify(msg, true);
      targetGrid.innerHTML = `<div class="sh-lineup-card"><p>${msg}</p></div>`;
      return;
    }

    const isBreakMode = lineups.some(l => l.isLeagueOnBreakMode);
    if (isBreakMode) {
      this.notify(`⏸️ ${this.currentCompetition.name} in Sosta Club in ${selectedGw?.label || 'questa GW'}: generate comunque ${lineups.length} formazioni (4 In-Season + 1 Classic con fallback automatico).`);
    } else {
      const targetStr = this.targetThreshold > 0 ? ` • Target Soglia: ${this.targetThreshold} pt` : '';
      this.notify(`✅ Generate ${lineups.length} formazioni ottimali per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr}${targetStr}`);
    }

    const isInSeasonSo5 = this.currentCompetition.format === 'SO5';

    targetGrid.innerHTML = lineups.map((lineup, idx) => {
      const orderedStarters = this.sortStartersByCanonicalOrder(lineup.starters);
      const classicCount = orderedStarters.length - lineup.inSeasonCount;
      const mixLabel = isInSeasonSo5
        ? `${lineup.inSeasonCount} In-Season${classicCount > 0 ? ` + ${classicCount} Classic` : ''}`
        : `${lineup.inSeasonCount} In-Season`;

      const targetBadgeHtml = lineup.thresholdInfo
        ? `<div class="sh-target-pill ${lineup.thresholdInfo.delta >= 0 ? 'target-pass' : 'target-warn'}">
             ${lineup.thresholdInfo.statusLabel} (${lineup.thresholdInfo.probabilityPct}%)
           </div>`
        : '';

      const playersHtml = orderedStarters.map(p => {
        const capBadge = p.isCaptain ? ' <strong>[C]</strong>' : '';
        const seasonTag = p.isInSeason
          ? '<span class="sh-season-badge in-season">26/27</span>'
          : '<span class="sh-season-badge classic">CLASSIC</span>';
        const doubleGwTag = p.hasDoubleMatch
          ? `<span class="sh-season-badge double-gw" title="Gioca 2 partite in questa Gameweek!">🔥 2 GARE</span>`
          : '';

        const gwMatches = Array.isArray(p.gwMatches) ? p.gwMatches : (p.activeMatch ? [p.activeMatch] : []);
        let matchLine = '⏸️ Sosta Club in questa GW';

        if (gwMatches.length >= 2) {
          const m1 = gwMatches[0];
          const m2 = gwMatches[1];
          const prefix = m1.isNationalTeam ? '🌍' : '🏟️';
          matchLine = `${prefix} vs ${this.escapeHtml(m1.opponentName)} + vs ${this.escapeHtml(m2.opponentName)}`;
        } else if (gwMatches.length === 1) {
          const m1 = gwMatches[0];
          if (m1.isNationalTeam) {
            matchLine = `🌍 ${this.escapeHtml(m1.teamName)} (${this.escapeHtml(m1.competitionName)})`;
          } else {
            matchLine = `${m1.isHome === true ? '🏠' : '✈️'} vs ${this.escapeHtml(m1.opponentName)} (${this.escapeHtml(m1.competitionName)})`;
          }
        }

        const isConfirmedStarter = p.availabilityTier === 'starter' || this.manualOverrides[p.playerSlug] === 'xi';
        const xiBtnLabel = isConfirmedStarter ? '✅ XI' : '⚠️ Rot.';
        const xiBtnCls = isConfirmedStarter ? 'sh-xi-btn xi-confirmed' : 'sh-xi-btn xi-rotation';
        const roleCls = `pos-${p.displayRole.toLowerCase()}`;

        const formTagLabel = p.contextFormLabel || 'Forma';
        const formTagVal = p.contextFormScore !== undefined ? p.contextFormScore : p.l5;
        const aasTagVal = p.contextAas !== undefined ? p.contextAas : p.avgAas;
        const avatarHtml = this.buildCustomAvatarHtml(p);

        return `
          <div class="sh-row">
            <div class="sh-pos ${roleCls}">${p.displayRole}</div>
            ${avatarHtml}
            <div class="sh-meta">
              <div class="sh-name">
                ${this.escapeHtml(p.name)}${capBadge}${seasonTag}${doubleGwTag}
                <span class="player-info-trigger" tabindex="0">?
                  <span class="tactical-tooltip-box">${this.escapeHtml(p.matchupInsight || '')}</span>
                </span>
              </div>
              <div class="sh-sub">${this.escapeHtml(p.club)} • ${matchLine} • ${formTagLabel}: ${formTagVal} • L15: ${p.l15} • AA: ${aasTagVal}</div>
            </div>
            <div class="sh-right">
              <div class="sh-pts">${p.projectedScore} pt</div>
              <button type="button" class="${xiBtnCls}" data-slug="${this.escapeHtml(p.playerSlug)}" title="Verde = Titolare confermato. Clicca per spostarlo in Panchina se non parte dal 1'">${xiBtnLabel}</button>
            </div>
          </div>
        `;
      }).join('');

      const hotStreakBtnHtml = isInSeasonSo5
        ? `<button type="button" class="sh-direct-submit-btn hotstreak-btn" data-direct-submit-idx="${idx}" data-submit-mode="hotstreak" title="Invia direttamente con 1 clic la formazione nella modalità Hot Streak PRO">
             🔥 Hot Streak
           </button>`
        : '';

      return `
        <div class="sh-lineup-card">
          <div>
            <div class="sh-card-head">
              <div>
                <div class="sh-rank">${this.escapeHtml(lineup.rankLabel)}</div>
                <div class="sh-comp">${this.currentCompetition.name} (${lineup.format} • ${mixLabel})</div>
                <div class="sh-brand-watermark">⚽ SorareHub • Pro Optimizer</div>
              </div>
              <div style="text-align:right;">
                <div class="sh-score">${lineup.totalProjected} pt</div>
                ${targetBadgeHtml}
              </div>
            </div>
            <div>${playersHtml}</div>
          </div>
          <div class="sh-direct-submit-footer">
            <button type="button" class="sh-direct-submit-btn" data-direct-submit-idx="${idx}" data-submit-mode="standard">
              ⚡ Invia Torneo
            </button>
            ${hotStreakBtnHtml}
            <button type="button" class="sh-direct-submit-btn preset-btn" data-pin-preset-idx="${idx}" title="Fissa questa formazione come Pre-Set Step e riserva le sue 5 carte">
              📌 Pre-Set
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  renderEmptyState() {
    const grid = document.getElementById('lineups-output') || document.getElementById('lineups-grid') || document.getElementById('sorarehub-horizontal-grid');
    if (grid) {
      grid.innerHTML = `<div class="sh-lineup-card"><p>Connetti il tuo account <strong>Sorare</strong> in alto a destra per sincronizzare le tue carte.</p></div>`;
    }
  },

  notify(msg, isError = false) {
    this.ensureBannerElement();
    const banner = document.getElementById('status-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.className = isError ? 'status-banner error' : 'status-banner success';
    banner.style.display = 'block';
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
