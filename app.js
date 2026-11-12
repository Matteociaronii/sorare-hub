// SorareHub - Application Controller (Carbon & Gold Edition + Real GW Selector + National Team Display + Touch/Hover Tooltip)
const App = {
  cards: [],
  gameweeks: [],
  selectedGwIndex: 0,
  user: null,
  currentScarcity: 'limited',
  currentStrategy: 'floor',
  currentCompetition: CONFIG.OFFICIAL_COMPETITIONS[0],

  async init() {
    this.injectTacticalStyles();
    this.populateCompetitionDropdown();
    this.bindEvents();

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      this.notify('🔐 Autenticazione Sorare in corso...');
      const token = await SorareAPI.handleOAuthCallback(code);
      if (token) {
        await this.loadUserGallery();
      }
      return;
    }

    if (localStorage.getItem('sorare_access_token')) {
      await this.loadUserGallery();
    } else {
      this.renderEmptyState();
    }
  },

  injectTacticalStyles() {
    if (document.getElementById('sorarehub-tactical-styles')) return;
    const style = document.createElement('style');
    style.id = 'sorarehub-tactical-styles';
    style.textContent = `
      .player-info-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 19px;
        height: 19px;
        margin-left: 6px;
        border-radius: 50%;
        background: rgba(212, 175, 55, 0.16);
        border: 1px solid rgba(212, 175, 55, 0.65);
        color: #f3d266;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        vertical-align: middle;
        position: relative;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: all 0.15s ease;
      }
      .player-info-trigger:hover,
      .player-info-trigger.active {
        background: #d4af37;
        color: #111111;
        transform: scale(1.08);
      }
      .tactical-tooltip-box {
        display: none;
        position: absolute;
        left: 0;
        top: calc(100% + 8px);
        width: 285px;
        max-width: 82vw;
        background: #141519;
        border: 1px solid rgba(212, 175, 55, 0.7);
        border-radius: 10px;
        padding: 11px 13px;
        color: #ececec;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.48;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.88);
        z-index: 9999;
        text-align: left;
        white-space: normal;
        pointer-events: auto;
      }
      .player-info-trigger:hover .tactical-tooltip-box,
      .player-info-trigger.active .tactical-tooltip-box {
        display: block;
      }
      .tactical-tooltip-title {
        display: block;
        color: #f3d266;
        font-weight: 700;
        font-size: 11.5px;
        margin-bottom: 5px;
        letter-spacing: 0.3px;
        text-transform: uppercase;
      }
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
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  },

  renderGwSelector() {
    if (!this.gameweeks || this.gameweeks.length === 0) return;

    let container = document.getElementById('gw-selector-container');
    if (!container) {
      const compSelect = document.getElementById('comp-select');
      if (!compSelect || !compSelect.parentElement) return;
      container = document.createElement('div');
      container.id = 'gw-selector-container';
      container.className = 'gw-selector-pill';
      compSelect.parentElement.appendChild(container);
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

  async loadUserGallery() {
    const loginBtn = document.getElementById('login-btn');
    const loginBtnText = document.getElementById('login-btn-text');

    if (loginBtn) loginBtn.disabled = true;
    if (loginBtnText) loginBtnText.textContent = '⏳ Sincronizzazione GW & Opta...';

    try {
      const data = await SorareAPI.fetchCurrentUserGallery();
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

        this.renderGwSelector();
        const activeGw = this.gameweeks[this.selectedGwIndex];
        const gwBadge = activeGw ? ` • ${activeGw.label} (${activeGw.dateRangeText})` : '';
        this.notify(`✅ Sincronizzate ${this.cards.length} carte${gwBadge}`);
        this.runOptimizer();
      }
    } catch (err) {
      console.error('Errore fetch galleria:', err);
      if (loginBtn) loginBtn.disabled = false;
      if (loginBtnText) loginBtnText.textContent = 'Connetti Sorare';
      this.notify('❌ Errore caricamento galleria: ' + err.message, true);
    }
  },

  populateCompetitionDropdown() {
    const select = document.getElementById('comp-select');
    if (!select) return;

    select.innerHTML = CONFIG.OFFICIAL_COMPETITIONS.map(comp => {
      const badge = comp.format === 'SO7' ? '[SO7 Classic]' : '[SO5 In-Season]';
      return `<option value="${comp.id}">${badge} ${comp.name}</option>`;
    }).join('');
  },

  bindEvents() {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => SorareAPI.startOAuthFlow());
    }

    const compSelect = document.getElementById('comp-select');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        const found = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === e.target.value);
        if (found) {
          this.currentCompetition = found;
          this.runOptimizer();
        }
      });
    }

    document.querySelectorAll('#scarcity-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#scarcity-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentScarcity = e.currentTarget.dataset.scarcity;
        this.runOptimizer();
      });
    });

    document.querySelectorAll('#strategy-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#strategy-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentStrategy = e.currentTarget.dataset.strategy;
        this.runOptimizer();
      });
    });

    const genBtn = document.getElementById('generate-btn');
    if (genBtn) {
      genBtn.addEventListener('click', () => this.runOptimizer());
    }

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
    });
  },

  runOptimizer() {
    if (!this.cards || this.cards.length === 0) {
      this.renderEmptyState();
      return;
    }

    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;
    const lineups = OptimizerEngine.buildCascadePortfolio(
      this.cards,
      this.currentCompetition,
      this.currentScarcity,
      this.currentStrategy,
      selectedGw
    );

    this.renderLineups(lineups, selectedGw);
  },

  renderLineups(lineups, selectedGw) {
    const grid = document.getElementById('lineups-grid');
    const summary = document.getElementById('portfolio-summary');
    const gwInfoStr = selectedGw ? ` • <strong>${selectedGw.label}</strong> (${selectedGw.dateRangeText})` : '';

    if (!lineups || lineups.length === 0) {
      if (summary) {
        summary.innerHTML = `Nessuna formazione valida per <strong>${this.currentCompetition.name}</strong> (${this.currentScarcity.toUpperCase()})${gwInfoStr}.`;
      }
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state">
            <p>Non hai abbastanza carte eleggibili in <strong>${this.currentScarcity.toUpperCase()}</strong> per completare i ruoli richiesti in <strong>${this.currentCompetition.name}</strong>${gwInfoStr}.</p>
          </div>
        `;
      }
      return;
    }

    const totalPortfolioPoints = lineups.reduce((acc, l) => acc + l.totalProjected, 0);
    if (summary) {
      summary.innerHTML = `
        <strong>${lineups.length} Formazioni Ottimizzate</strong> per <strong>${this.currentCompetition.name}</strong> (${this.currentScarcity.toUpperCase()})${gwInfoStr} •
        Proiezione Totale Portafoglio: <strong>${totalPortfolioPoints} pt</strong>
      `;
    }

    if (grid) {
      grid.innerHTML = lineups.map(lineup => {
        const formatBadge = lineup.format === 'SO7'
          ? `<span class="badge-so7">SO7 • 7 Titolari (Classic)</span>`
          : `<span class="badge-so5">SO5 • ${lineup.inSeasonCount}/5 In-Season</span>`;

        const playersHtml = lineup.starters.map(p => {
          const capBadge = p.isCaptain ? `<span class="cap-badge">C +50%</span>` : '';
          const seasonBadge = p.isInSeason
            ? `<span class="season-tag in-season">26/27</span>`
            : `<span class="season-tag classic">CLASSIC</span>`;

          const statusBadge = p.isLastResort
            ? `<span class="status-tag last-resort" title="${this.escapeHtml(p.unavailableReason)}">⚠️ RISERVA</span>`
            : (p.availabilityTier === 'rotation'
              ? `<span class="status-tag xi-ok" style="opacity:0.85;">ROT</span>`
              : `<span class="status-tag xi-ok">XI</span>`);

          const isNat = p.activeMatch?.isNationalTeam === true;
          const matchLine = isNat
            ? `🌍 ${this.escapeHtml(p.activeMatch.teamName)} (${this.escapeHtml(p.activeMatch.competitionName)})`
            : `${p.isHome === true ? '🏠' : (p.isHome === false ? '✈️' : '⚠️')} vs ${this.escapeHtml(p.opponentName)}`;

          const safeInsight = this.escapeHtml(p.matchupInsight || '');
          const safeName = this.escapeHtml(p.name);

          return `
            <div class="player-row ${p.isCaptain ? 'captain-row' : ''} ${p.isLastResort ? 'last-resort-row' : ''}">
              <div class="pos-pill pos-${p.slotRole.toLowerCase()}">${p.slotRole}</div>
              <div class="player-meta">
                <div class="player-name">
                  ${safeName} ${capBadge} ${seasonBadge} ${statusBadge}
                  <span class="player-info-trigger" tabindex="0" aria-label="Analisi tattica ${safeName}">?
                    <span class="tactical-tooltip-box">
                      <span class="tactical-tooltip-title">Analisi Matchup • ${safeName}</span>
                      ${safeInsight}
                    </span>
                  </span>
                </div>
                <div class="player-sub">${this.escapeHtml(p.club)} • ${matchLine} • L15: ${p.l15} • L5: ${p.l5} • Bonus +${p.bonusPct}%</div>
              </div>
              <div class="player-score">${p.projectedScore}<span>pt</span></div>
            </div>
          `;
        }).join('');

        return `
          <div class="lineup-card">
            <div class="lineup-header">
              <div>
                <div class="lineup-rank">${lineup.rankLabel}</div>
                <div class="lineup-comp">${this.currentCompetition.name}</div>
              </div>
              <div class="lineup-total">
                <div class="total-val">${lineup.totalProjected}</div>
                <div class="total-lbl">EV PROIETTATO</div>
              </div>
            </div>
            <div class="lineup-badges">${formatBadge}</div>
            <div class="lineup-players">${playersHtml}</div>
          </div>
        `;
      }).join('');
    }
  },

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  renderEmptyState() {
    const grid = document.getElementById('lineups-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>Connetti il tuo account <strong>Sorare</strong> in alto a destra per sincronizzare automaticamente tutte le tue carte e calcolare le formazioni ottimali per ogni torneo.</p>
        </div>
      `;
    }
  },

  notify(msg, isError = false) {
    const banner = document.getElementById('status-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.className = isError ? 'status-banner error' : 'status-banner success';
    banner.style.display = 'block';
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
