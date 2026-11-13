// SorareHub - Application Controller (Double Match Badge + Dynamic Opponent Form UI)
const App = {
  cards: [],
  gameweeks: [],
  selectedGwIndex: 0,
  selectedClubSlug: 'ALL',
  manualOverrides: {},
  user: null,
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
    this.injectFavicon();
    this.injectTacticalStyles();
    this.ensureBannerElement();
    this.populateCompetitionDropdown();
    this.bindEvents();

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      this.notify('🔐 Autenticazione Sorare in corso...');
      const token = await SorareAPI.handleOAuthCallback(code);
      if (token) {
        await this.loadUserGallery(true);
      }
      return;
    }

    if (localStorage.getItem('sorare_access_token')) {
      await this.loadUserGallery(false);
    } else {
      this.renderEmptyState();
    }
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

  updateGalleryCounters(lineupsCount = 0) {
    const total = this.cards.length;
    const inSeasonTotal = this.cards.filter(c => c.isInSeason).length;
    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;

    let confirmedXiCount = 0;
    const roleActiveCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const seenSlugs = new Set();

    this.cards.forEach(c => {
      if (c.isInjuredOrSuspended) return;
      if (this.manualOverrides[c.playerSlug] === 'bench') return;
      if (c.scarcity !== this.currentScarcity) return;
      if (!OptimizerEngine.isCardEligibleForCompetition(c, this.currentCompetition, this.currentScarcity)) return;

      const games = Array.isArray(c.scheduleGames) ? c.scheduleGames : [];
      const validGames = games.filter(g => OptimizerEngine.isGameValidForCompetition(g, c, this.currentCompetition));
      let gwMatches = [];

      if (selectedGw && selectedGw.startDate && selectedGw.endDate) {
        const s = new Date(selectedGw.startDate).getTime();
        const e = new Date(selectedGw.endDate).getTime();
        gwMatches = validGames.filter(g => g.timestamp >= s && g.timestamp <= e);
      }

      if (gwMatches.length > 0 && !seenSlugs.has(c.playerSlug)) {
        seenSlugs.add(c.playerSlug);
        confirmedXiCount++;
        if (roleActiveCounts[c.position] !== undefined) {
          roleActiveCounts[c.position]++;
        }
      }
    });

    const allContainers = document.querySelectorAll('div, section, article');
    allContainers.forEach(el => {
      if (el.children.length === 3) {
        const label = (el.children[0]?.textContent || '').trim().toUpperCase();
        const valEl = el.children[1];
        const subEl = el.children[2];

        if (label === 'CARTE IN GALLERIA') {
          valEl.textContent = String(total);
          if (subEl) subEl.textContent = this.user?.nickname ? `Sincronizzato • @${this.user.nickname}` : 'Galleria Pro Attiva';
        } else if (label === 'CARTE IN-SEASON') {
          valEl.textContent = String(inSeasonTotal);
          if (subEl) subEl.textContent = `26/27 pronte (${this.currentScarcity.toUpperCase()})`;
        } else if (label.includes('CONFIRMED XI') || label.includes('TITOLARI')) {
          valEl.textContent = String(confirmedXiCount);
          if (subEl) subEl.textContent = `Con match in ${selectedGw?.label?.split(' ')[0] || 'GW'}`;
        } else if (label === 'SQUADRE GENERATE') {
          valEl.textContent = String(lineupsCount);
          if (subEl) subEl.textContent = `SorareHub Engine • ${this.currentStrategy.toUpperCase()}`;
        }
      }
    });

    this.upgradeSecondaryInfoBoxes(selectedGw, roleActiveCounts);
  },

  upgradeSecondaryInfoBoxes(selectedGw, roleActiveCounts) {
    const rarityCards = this.cards.filter(c =>
      c.scarcity === this.currentScarcity &&
      !c.isInjuredOrSuspended &&
      OptimizerEngine.isCardEligibleForCompetition(c, this.currentCompetition, this.currentScarcity)
    );
    const isCount = rarityCards.filter(c => c.isInSeason).length;
    const classicCount = rarityCards.length - isCount;
    const injuredCount = this.cards.filter(c => c.scarcity === this.currentScarcity && c.isInjuredOrSuspended).length;

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
              📡 Radar Giocatori con Match in ${selectedGw ? selectedGw.label : 'GW Attiva'} (${selectedGw ? selectedGw.dateRangeText : ''})
            </div>
            <div style="font-size:12.5px;color:#e0e0e0;margin-top:4px;">
              Schierabili nel torneo: <strong>GK: ${roleActiveCounts.GK}</strong> • <strong>DC: ${roleActiveCounts.DEF}</strong> • <strong>CC: ${roleActiveCounts.MID}</strong> • <strong>ATT: ${roleActiveCounts.FWD}</strong>
            </div>
          </div>
        </div>
      `;

      rightBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;font-weight:800;color:#64b5f6;text-transform:uppercase;letter-spacing:0.5px;">
              🃏 Rosa Eleggibile ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})
            </div>
            <div style="font-size:12.5px;color:#e0e0e0;margin-top:4px;">
              <strong>${isCount} In-Season (26/27)</strong> • <strong>${classicCount} Classic</strong> • <span style="color:#ff8a95;">🚑 ${injuredCount} Infortunati esclusi</span>
            </div>
          </div>
        </div>
      `;
    }
  },

  injectTacticalStyles() {
    if (document.getElementById('sorarehub-tactical-styles')) return;
    const style = document.createElement('style');
    style.id = 'sorarehub-tactical-styles';
    style.textContent = `
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
      #lineups-grid, #sorarehub-horizontal-grid, .lineups-grid {
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
        flex: 0 0 400px !important;
        min-width: 380px !important;
        max-width: 425px !important;
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
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.09);
        padding-bottom: 10px;
        margin-bottom: 10px;
      }
      .sh-rank { color: #f3d266; font-weight: 800; font-size: 16px; }
      .sh-comp { color: #9aa0a6; font-size: 12px; margin-top: 2px; }
      .sh-score { color: #f3d266; font-weight: 800; font-size: 21px; text-align: right; }
      .sh-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .sh-row:last-child { border-bottom: none; }
      .sh-pos {
        min-width: 48px;
        text-align: center;
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 11px;
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
        width: 360px;
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
        gap: 10px;
        margin-top: 10px;
      }
      .gw-selector-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(212, 175, 55, 0.12);
        border: 1px solid rgba(212, 175, 55, 0.45);
        border-radius: 8px;
        padding: 6px 11px;
        color: #f3d266;
        font-size: 12px;
        font-weight: 600;
      }
      .gw-selector-pill select {
        background: #141519;
        color: #f3d266;
        border: 1px solid rgba(212, 175, 55, 0.4);
        border-radius: 5px;
        padding: 4px 7px;
        font-size: 12px;
        font-weight: 700;
      }
      .club-xi-strip {
        width: 100%;
        background: rgba(33, 150, 243, 0.08);
        border: 1px solid rgba(33, 150, 243, 0.35);
        border-radius: 9px;
        padding: 8px 12px;
        margin-top: 6px;
        font-size: 12px;
        color: #e0e0e0;
      }
      .benched-restore-strip {
        width: 100%;
        background: rgba(244, 67, 54, 0.1);
        border: 1px solid rgba(244, 67, 54, 0.4);
        border-radius: 9px;
        padding: 7px 12px;
        margin-top: 6px;
        font-size: 12px;
        color: #ffcdd2;
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
    `;
    document.head.appendChild(style);
  },

  getCompetitionSelectEl() {
    return (
      document.getElementById('comp-select') ||
      document.getElementById('competition-select') ||
      document.getElementById('tournament-select') ||
      Array.from(document.querySelectorAll('select')).find(s => s.id !== 'gw-select' && s.id !== 'club-stack-select')
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
      const compSelect = this.getCompetitionSelectEl();
      const targetParent = (compSelect && compSelect.parentElement) || document.getElementById('status-banner')?.parentElement;
      if (!targetParent) return;
      container = document.createElement('div');
      container.id = 'gw-selector-container';
      container.className = 'sh-controls-bar';
      targetParent.appendChild(container);
    }

    const gwOptionsHtml = this.gameweeks
      .map((gw, idx) => `<option value="${idx}" ${idx === this.selectedGwIndex ? 'selected' : ''}>${gw.label} • ${gw.dateRangeText}</option>`)
      .join('');

    const availableClubs = OptimizerEngine.getAvailableClubsForCompetition(
      this.cards,
      this.currentCompetition,
      this.currentScarcity
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

    let clubXiStripHtml = '';
    if (this.selectedClubSlug && this.selectedClubSlug !== 'ALL') {
      const clubCards = this.cards.filter(c =>
        c.scarcity === this.currentScarcity &&
        c.clubSlug === this.selectedClubSlug &&
        !c.isInjuredOrSuspended
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

      clubXiStripHtml = `
        <div class="club-xi-strip">
          <div style="margin-bottom:4px;font-weight:700;color:#81c784;">
            🎯 11 Titolari Ufficiali (${this.escapeHtml(uniqueClubPlayers[0]?.club || '')}) — Verde = Titolare XI (✅) • Rosso = Panchina (🪑):
          </div>
          <div>${chips}</div>
        </div>
      `;
    }

    const benchedSlugs = Object.keys(this.manualOverrides).filter(slug => this.manualOverrides[slug] === 'bench');
    let benchedRestoreHtml = '';
    if (benchedSlugs.length > 0) {
      const benchedChips = benchedSlugs.map(slug => {
        const foundCard = this.cards.find(c => c.playerSlug === slug);
        const pName = foundCard ? foundCard.name : slug;
        return `<span class="club-xi-chip benched" data-restore-slug="${this.escapeHtml(slug)}" title="Clicca per rimettere subito tra i Titolari XI">🪑 ${this.escapeHtml(pName)} (Ripristina XI ↩)</span>`;
      }).join('');

      benchedRestoreHtml = `
        <div class="benched-restore-strip">
          <strong>🪑 Giocatori esclusi (Panchina):</strong> ${benchedChips}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="gw-selector-pill">
        <span>📅 GW Sorare:</span>
        <select id="gw-select">${gwOptionsHtml}</select>
      </div>
      <div class="gw-selector-pill">
        <span>🏟️ Stack Squadra:</span>
        <select id="club-stack-select">${clubOptionsHtml}</select>
      </div>
      ${clubXiStripHtml}
      ${benchedRestoreHtml}
    `;

    const gwSelect = document.getElementById('gw-select');
    if (gwSelect) {
      gwSelect.addEventListener('change', (e) => {
        this.selectedGwIndex = Number(e.target.value) || 0;
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
    const loginBtn = document.getElementById('login-btn') || document.getElementById('connect-btn');
    const loginBtnText = document.getElementById('login-btn-text') || loginBtn;

    if (loginBtn) loginBtn.disabled = true;
    if (loginBtnText) loginBtnText.textContent = '⏳ Sincronizzazione...';
    this.notify('⏳ Connessione a Sorare in corso...');

    try {
      const data = await SorareAPI.fetchCurrentUserGallery(forceRefresh);
      if (data && data.cards) {
        this.user = data.user;
        this.cards = data.cards;
        this.gameweeks = data.gameweeks || [];
        this.selectedGwIndex = 0;

        if (loginBtnText) {
          loginBtnText.textContent = `✅ @${this.user?.nickname || 'Manager'} (${this.cards.length} carte)`;
        }
        if (loginBtn) {
          loginBtn.classList.add('connected');
          loginBtn.disabled = false;
        }

        this.syncStateFromDOM();
        this.renderGwAndClubSelectors();
        this.runOptimizer();
      }
    } catch (err) {
      console.error('Errore fetch galleria:', err);
      if (loginBtn) loginBtn.disabled = false;
      if (loginBtnText) loginBtnText.textContent = 'Connetti Sorare';
      this.notify('❌ Errore caricamento: ' + err.message, true);
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
    const loginBtn = document.getElementById('login-btn') || document.getElementById('connect-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => SorareAPI.startOAuthFlow());
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
        this.runOptimizer();
      });
    });

    document.addEventListener('click', (e) => {
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
      if (btn && btn.id !== 'login-btn' && btn.id !== 'connect-btn') {
        const txt = (btn.textContent || '').toLowerCase();
        if (txt.includes('genera') || txt.includes('ottimizz') || txt.includes('calcola') || btn.id === 'generate-btn' || btn.id === 'optimize-btn') {
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

  runOptimizer() {
    if (!this.cards || this.cards.length === 0) {
      this.notify('⚠️ Nessuna carta sincronizzata: clicca su Connetti Sorare.', true);
      return;
    }

    this.syncStateFromDOM();
    this.renderGwAndClubSelectors();
    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;

    const lineups = window.OptimizerEngine
      ? OptimizerEngine.buildCascadePortfolio(
          this.cards,
          this.currentCompetition,
          this.currentScarcity,
          this.currentStrategy,
          selectedGw,
          this.manualOverrides,
          this.selectedClubSlug
        )
      : [];

    this.updateGalleryCounters(lineups.length);
    this.renderLineups(lineups, selectedGw);
  },

  renderLineups(lineups, selectedGw) {
    const existingGrid =
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
      const reason = isStack
        ? `Non hai tutti i ruoli (GK, DC, CC, ATT) tra gli 11 titolari di questo club (o mancano le ${this.currentCompetition.inSeasonRequired || 0}/5 In-Season).`
        : `Non possiedi abbastanza carte ${this.currentCompetition.inSeasonRequired > 0 ? `In-Season 26/27 (richieste ${this.currentCompetition.inSeasonRequired}/5)` : ''} appartenenti ai club di ${this.currentCompetition.name}.`;
      const msg = `⚠️ 0 formazioni per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr} — ${reason}`;
      this.notify(msg, true);
      targetGrid.innerHTML = `<div class="sh-lineup-card"><p>${msg}</p></div>`;
      return;
    }

    const isBreakMode = lineups.some(l => l.isLeagueOnBreakMode);
    if (isBreakMode) {
      this.notify(`⏸️ ${this.currentCompetition.name} in Sosta Club in ${selectedGw?.label || 'questa GW'}: generate comunque ${lineups.length} formazioni (con appartenenza club e 4/5 In-Season verificati).`);
    } else {
      this.notify(`✅ Generate ${lineups.length} formazioni ottimali per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr}`);
    }

    targetGrid.innerHTML = lineups.map(lineup => {
      const orderedStarters = this.sortStartersByCanonicalOrder(lineup.starters);

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

        return `
          <div class="sh-row">
            <div class="sh-pos ${roleCls}">${p.displayRole}</div>
            <div class="sh-meta">
              <div class="sh-name">
                ${this.escapeHtml(p.name)}${capBadge}${seasonTag}${doubleGwTag}
                <span class="player-info-trigger" tabindex="0">?
                  <span class="tactical-tooltip-box">${this.escapeHtml(p.matchupInsight || '')}</span>
                </span>
              </div>
              <div class="sh-sub">${this.escapeHtml(p.club)} • ${matchLine} • L15: ${p.l15} • AA: ${p.avgAas}</div>
            </div>
            <div class="sh-right">
              <div class="sh-pts">${p.projectedScore} pt</div>
              <button type="button" class="${xiBtnCls}" data-slug="${this.escapeHtml(p.playerSlug)}" title="Verde = Titolare confermato. Clicca per spostarlo in Panchina se non parte dal 1'">${xiBtnLabel}</button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="sh-lineup-card">
          <div>
            <div class="sh-card-head">
              <div>
                <div class="sh-rank">${this.escapeHtml(lineup.rankLabel)}</div>
                <div class="sh-comp">${this.currentCompetition.name} (${lineup.format} • ${lineup.inSeasonCount} In-Season)</div>
              </div>
              <div class="sh-score">${lineup.totalProjected} pt</div>
            </div>
            <div>${playersHtml}</div>
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
    const grid = document.getElementById('lineups-grid') || document.getElementById('sorarehub-horizontal-grid');
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
