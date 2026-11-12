// SorareHub - Self-Healing Application Controller (Auto-Fallback Lineup Generation + Full DOM Sync)
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

    const statCards = document.querySelectorAll('.stat-card, .kpi-card, .metric-card, .summary-card, .stat-box, .stats-grid > div, .kpi-grid > div');
    statCards.forEach((card, idx) => {
      const valEl = card.querySelector('.stat-val, .stat-value, .kpi-value, .count, h2, h3, span:first-child, strong');
      if (!valEl) return;
      const labelTxt = card.textContent.toLowerCase();

      if (labelTxt.includes('in-season') || labelTxt.includes('26/27') || labelTxt.includes('stagione')) {
        valEl.textContent = String(inSeasonTotal);
      } else if (labelTxt.includes('squadr') || labelTxt.includes('formazion') || labelTxt.includes('lineup') || labelTxt.includes('generat')) {
        valEl.textContent = String(lineupsCount);
      } else if (labelTxt.includes('cart') || labelTxt.includes('galleri') || idx === 0) {
        valEl.textContent = String(total);
      } else if (idx === 1) {
        valEl.textContent = String(inSeasonTotal);
      } else if (idx === 2) {
        valEl.textContent = String(lineupsCount);
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
        max-width: 1200px;
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
      #sorarehub-fallback-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 18px;
        width: 100%;
        max-width: 1200px;
        margin: 18px auto;
        padding: 0 12px;
        box-sizing: border-box;
      }
      .sh-card {
        background: #141519;
        border: 1px solid rgba(212, 175, 55, 0.35);
        border-radius: 12px;
        padding: 16px;
        color: #f0f0f0;
      }
      .sh-card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding-bottom: 10px;
        margin-bottom: 10px;
      }
      .sh-rank { color: #f3d266; font-weight: 800; font-size: 15px; }
      .sh-comp { color: #9aa0a6; font-size: 12px; }
      .sh-score { color: #f3d266; font-weight: 800; font-size: 20px; text-align: right; }
      .sh-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .sh-row:last-child { border-bottom: none; }
      .sh-pos {
        min-width: 42px;
        text-align: center;
        padding: 3px 6px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 800;
        background: rgba(212, 175, 55, 0.18);
        color: #f3d266;
      }
      .sh-meta { flex: 1; min-width: 0; }
      .sh-name { font-weight: 700; font-size: 13.5px; color: #fff; }
      .sh-sub { font-size: 11.5px; color: #9aa0a6; margin-top: 2px; }
      .sh-pts { font-weight: 800; font-size: 14px; color: #f3d266; }
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
        width: 270px;
        max-width: 80vw;
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

  runOptimizer() {
    if (!this.cards || this.cards.length === 0) {
      this.notify('⚠️ Nessuna carta sincronizzata: clicca su Connetti Sorare.', true);
      return;
    }

    this.syncStateFromDOM();
    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;

    // 1. Prova con il torneo selezionato esatto
    let lineups = window.OptimizerEngine
      ? OptimizerEngine.buildCascadePortfolio(this.cards, this.currentCompetition, this.currentScarcity, this.currentStrategy, selectedGw)
      : [];

    // 2. Auto-fallback: se il torneo SO5 richiede In-Season ma non ce ne sono abbastanza, calcola comunque la formazione Classic/SO5 migliore
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
      targetGrid = document.getElementById('sorarehub-fallback-grid');
      if (!targetGrid) {
        targetGrid = document.createElement('div');
        targetGrid.id = 'sorarehub-fallback-grid';
        const mainEl = document.querySelector('main') || document.body;
        mainEl.appendChild(targetGrid);
      }
    }

    const gwInfoStr = selectedGw ? ` • ${selectedGw.label} (${selectedGw.dateRangeText})` : '';
    const rarityCards = this.cards.filter(c => c.scarcity === this.currentScarcity.toLowerCase());

    if (!lineups || lineups.length === 0) {
      const msg = `⚠️ 0 formazioni generabili per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr} — Hai ${rarityCards.length} carte ${this.currentScarcity.toUpperCase()}.`;
      this.notify(msg, true);
      targetGrid.innerHTML = `<div class="sh-card"><p>${msg}</p></div>`;
      return;
    }

    this.notify(`✅ Generate ${lineups.length} formazioni per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr}`);

    targetGrid.innerHTML = lineups.map(lineup => {
      const playersHtml = lineup.starters.map(p => {
        const capBadge = p.isCaptain ? ' <strong>[C +50%]</strong>' : '';
        const isNat = p.activeMatch?.isNationalTeam === true;
        const matchLine = isNat
          ? `🌍 ${this.escapeHtml(p.activeMatch.teamName)} (${this.escapeHtml(p.activeMatch.competitionName)})`
          : `${p.isHome === true ? '🏠' : (p.isHome === false ? '✈️' : '⚠️')} vs ${this.escapeHtml(p.opponentName)}`;

        return `
          <div class="sh-row">
            <div class="sh-pos">${p.slotRole}</div>
            <div class="sh-meta">
              <div class="sh-name">
                ${this.escapeHtml(p.name)}${capBadge}
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
        <div class="sh-card">
          <div class="sh-card-head">
            <div>
              <div class="sh-rank">${lineup.rankLabel}</div>
              <div class="sh-comp">${this.currentCompetition.name} (${lineup.format})</div>
            </div>
            <div class="sh-score">${lineup.totalProjected} pt</div>
          </div>
          <div>${playersHtml}</div>
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
    const grid = document.getElementById('lineups-grid') || document.getElementById('sorarehub-fallback-grid');
    if (grid) {
      grid.innerHTML = `<div class="sh-card"><p>Connetti il tuo account <strong>Sorare</strong> in alto a destra per sincronizzare le tue carte.</p></div>`;
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
