// SorareHub - Horizontal Lineup Layout + Ordered Slots (GK -> DC -> CC -> ATT -> EXTRA) + Accurate 3 KPI Counters
const App = {
  cards: [],
  gameweeks: [],
  selectedGwIndex: 0,
  user: null,
  currentScarcity: 'limited',
  currentStrategy: 'floor',
  currentCompetition: (window.CONFIG && CONFIG.OFFICIAL_COMPETITIONS && CONFIG.OFFICIAL_COMPETITIONS[0]) || {
    id: 'all_star',
    name: 'All-Star',
    format: 'SO7',
    leagues: ['ALL'],
    inSeasonRequired: 0
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

    const mapById = {
      'gallery-count': total,
      'total-cards': total,
      'cards-count': total,
      'card-count': total,
      'stat-total-cards': total,
      'in-season-count': inSeasonTotal,
      'stat-in-season': inSeasonTotal,
      'lineups-count': lineupsCount,
      'stat-lineups': lineupsCount,
      'teams-count': lineupsCount
    };

    Object.entries(mapById).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    });

    // Aggiorna tutti i box numerici delle KPI card dell'HTML originale
    const kpiNodes = document.querySelectorAll('.stat-card, .kpi-card, .metric-card, .summary-card, .stat-box, .stats-row > div, .stats-grid > div');
    kpiNodes.forEach((box, idx) => {
      const numEl = box.querySelector('.stat-val, .stat-value, .kpi-value, .number, .count, h2, h3, strong, span');
      if (!numEl) return;
      const txt = box.textContent.toLowerCase();

      if (txt.includes('in-season') || txt.includes('26/27') || txt.includes('stagion')) {
        numEl.textContent = String(inSeasonTotal);
      } else if (txt.includes('squadr') || txt.includes('formazion') || txt.includes('lineup') || txt.includes('generat')) {
        numEl.textContent = String(lineupsCount);
      } else if (txt.includes('cart') || txt.includes('galleri') || idx === 0) {
        numEl.textContent = String(total);
      } else if (idx === 1) {
        numEl.textContent = String(inSeasonTotal);
      } else if (idx === 2) {
        numEl.textContent = String(lineupsCount);
      }
    });
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
      /* Griglia Orizzontale per le Formazioni */
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
        flex: 0 0 365px !important;
        min-width: 350px !important;
        max-width: 390px !important;
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
      .sh-pts { font-weight: 800; font-size: 14.5px; color: #f3d266; white-space: nowrap; }
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
        width: 265px;
        max-width: 78vw;
        background: #0e0f12;
        border: 1px solid #d4af37;
        border-radius: 8px;
        padding: 10px;
        color: #ececec;
        font-size: 11.5px;
        font-weight: 400;
        line-height: 1.45;
        z-index: 9999;
        white-space: normal;
      }
      .player-info-trigger:hover .tactical-tooltip-box,
      .player-info-trigger.active .tactical-tooltip-box { display: block; }
      .gw-selector-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(212, 175, 55, 0.12);
        border: 1px solid rgba(212, 175, 55, 0.45);
        border-radius: 8px;
        padding: 5px 10px;
        margin-top: 8px;
        color: #f3d266;
        font-size: 12px;
        font-weight: 600;
      }
      .gw-selector-pill select {
        background: #141519;
        color: #f3d266;
        border: 1px solid rgba(212, 175, 55, 0.4);
        border-radius: 5px;
        padding: 3px 6px;
        font-size: 12px;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  },

  getCompetitionSelectEl() {
    return (
      document.getElementById('comp-select') ||
      document.getElementById('competition-select') ||
      document.getElementById('tournament-select') ||
      Array.from(document.querySelectorAll('select')).find(s => s.id !== 'gw-select')
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

  renderGwSelector() {
    if (!this.gameweeks || this.gameweeks.length === 0) return;

    let container = document.getElementById('gw-selector-container');
    if (!container) {
      const compSelect = this.getCompetitionSelectEl();
      const targetParent = (compSelect && compSelect.parentElement) || document.getElementById('status-banner')?.parentElement;
      if (!targetParent) return;
      container = document.createElement('div');
      container.id = 'gw-selector-container';
      container.className = 'gw-selector-pill';
      targetParent.appendChild(container);
    }

    const optionsHtml = this.gameweeks
      .map((gw, idx) => `<option value="${idx}" ${idx === this.selectedGwIndex ? 'selected' : ''}>${gw.label} (${gw.dateRangeText})</option>`)
      .join('');

    container.innerHTML = `
      <span>📅 Gameweek:</span>
      <select id="gw-select">${optionsHtml}</select>
    `;

    const gwSelect = document.getElementById('gw-select');
    if (gwSelect) {
      gwSelect.addEventListener('change', (e) => {
        this.selectedGwIndex = Number(e.target.value) || 0;
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
        this.renderGwSelector();
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

  // Ordina rigorosamente gli slot in GK -> DC -> CC -> ATT -> EXTRA
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
    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;

    let lineups = window.OptimizerEngine
      ? OptimizerEngine.buildCascadePortfolio(this.cards, this.currentCompetition, this.currentScarcity, this.currentStrategy, selectedGw)
      : [];

    if ((!lineups || lineups.length === 0) && window.OptimizerEngine && this.currentCompetition.inSeasonRequired > 0) {
      const relaxedComp = { ...this.currentCompetition, inSeasonRequired: 0 };
      lineups = OptimizerEngine.buildCascadePortfolio(this.cards, relaxedComp, this.currentScarcity, this.currentStrategy, selectedGw);
    }

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
    const rarityCards = this.cards.filter(c => c.scarcity === this.currentScarcity.toLowerCase());
    const inSeasonInRarity = rarityCards.filter(c => c.isInSeason).length;

    if (!lineups || lineups.length === 0) {
      const msg = `⚠️ 0 formazioni generabili per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr} — Hai ${rarityCards.length} carte ${this.currentScarcity.toUpperCase()} (${inSeasonInRarity} In-Season).`;
      this.notify(msg, true);
      targetGrid.innerHTML = `<div class="sh-lineup-card"><p>${msg}</p></div>`;
      return;
    }

    this.notify(`✅ Generate ${lineups.length} formazioni per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr} • In-Season: ${inSeasonInRarity}`);

    targetGrid.innerHTML = lineups.map(lineup => {
      const orderedStarters = this.sortStartersByCanonicalOrder(lineup.starters);

      const playersHtml = orderedStarters.map(p => {
        const capBadge = p.isCaptain ? ' <strong>[C +50%]</strong>' : '';
        const seasonTag = p.isInSeason
          ? '<span class="sh-season-badge in-season">26/27</span>'
          : '<span class="sh-season-badge classic">CLASSIC</span>';

        const isNat = p.activeMatch?.isNationalTeam === true;
        const hasRealMatch = Boolean(p.activeMatch);

        let matchLine = '⏸️ Nessuna partita in GW';
        if (isNat) {
          matchLine = `🌍 ${this.escapeHtml(p.activeMatch.teamName)} (${this.escapeHtml(p.activeMatch.competitionName)})`;
        } else if (hasRealMatch) {
          matchLine = `${p.isHome === true ? '🏠' : '✈️'} vs ${this.escapeHtml(p.opponentName)}`;
        }

        const roleCls = `pos-${p.displayRole.toLowerCase()}`;

        return `
          <div class="sh-row">
            <div class="sh-pos ${roleCls}">${p.displayRole}</div>
            <div class="sh-meta">
              <div class="sh-name">
                ${this.escapeHtml(p.name)}${capBadge}${seasonTag}
                <span class="player-info-trigger" tabindex="0">?
                  <span class="tactical-tooltip-box">${this.escapeHtml(p.matchupInsight || '')}</span>
                </span>
              </div>
              <div class="sh-sub">${this.escapeHtml(p.club)} • ${matchLine} • L15: ${p.l15} • L5: ${p.l5}</div>
            </div>
            <div class="sh-pts">${p.projectedScore} pt</div>
          </div>
        `;
      }).join('');

      return `
        <div class="sh-lineup-card">
          <div>
            <div class="sh-card-head">
              <div>
                <div class="sh-rank">${lineup.rankLabel}</div>
                <div class="sh-comp">${this.currentCompetition.name} (${lineup.format})</div>
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
