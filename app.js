// SorareHub - Universal DOM-Agnostic Controller (Carbon & Gold Edition + All 3 Counters + Universal Generate Button)
const App = {
  cards: [],
  gameweeks: [],
  selectedGwIndex: 0,
  user: null,
  currentScarcity: 'limited',
  currentStrategy: 'floor',
  currentCompetition: CONFIG.OFFICIAL_COMPETITIONS[0],

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

  // Aggiorna tutti e 3 i contatori KPI presenti nella dashboard originale
  updateGalleryCounters(lineupsCount = null) {
    const total = this.cards.length;
    const inSeasonTotal = this.cards.filter(c => c.isInSeason).length;
    const startersTotal = this.cards.filter(c => c.baseFitnessTier === 'starter').length;

    const countsByRarity = {
      limited: this.cards.filter(c => c.scarcity === 'limited').length,
      rare: this.cards.filter(c => c.scarcity === 'rare').length,
      super_rare: this.cards.filter(c => c.scarcity === 'super_rare').length,
      unique: this.cards.filter(c => c.scarcity === 'unique').length
    };

    // 1. Aggiorna ID espliciti noti
    const mapById = {
      'gallery-count': total,
      'total-cards': total,
      'cards-count': total,
      'card-count': total,
      'stat-total-cards': total,
      'in-season-count': inSeasonTotal,
      'stat-in-season': inSeasonTotal,
      'starters-count': startersTotal,
      'stat-starters': startersTotal,
      'lineups-count': lineupsCount !== null ? lineupsCount : startersTotal,
      'stat-lineups': lineupsCount !== null ? lineupsCount : startersTotal,
      'count-limited': countsByRarity.limited,
      'count-rare': countsByRarity.rare,
      'count-super-rare': countsByRarity.super_rare,
      'count-unique': countsByRarity.unique
    };

    Object.entries(mapById).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    });

    // 2. Aggiorna automaticamente le card statistiche della dashboard (es. le 3 KPI card) leggendo la loro etichetta
    const statCards = document.querySelectorAll('.stat-card, .kpi-card, .metric-card, .summary-card, .stat-box');
    statCards.forEach((card, idx) => {
      const valEl = card.querySelector('.stat-val, .stat-value, .kpi-value, .count, h2, h3, strong');
      if (!valEl) return;
      const labelTxt = card.textContent.toLowerCase();

      if (labelTxt.includes('in-season') || labelTxt.includes('26/27') || labelTxt.includes('stagione')) {
        valEl.textContent = String(inSeasonTotal);
      } else if (labelTxt.includes('titolar') || labelTxt.includes('pront') || labelTxt.includes('formazion') || labelTxt.includes('lineup')) {
        valEl.textContent = String(lineupsCount !== null ? lineupsCount : startersTotal);
      } else if (labelTxt.includes('cart') || labelTxt.includes('galleri') || idx === 0) {
        valEl.textContent = String(total);
      } else if (idx === 1) {
        valEl.textContent = String(inSeasonTotal);
      } else if (idx === 2) {
        valEl.textContent = String(lineupsCount !== null ? lineupsCount : startersTotal);
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
        transition: all 0.2s ease;
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

  getCompetitionSelectEl() {
    return (
      document.getElementById('comp-select') ||
      document.getElementById('competition-select') ||
      document.getElementById('tournament-select') ||
      document.querySelector('select')
    );
  },

  syncStateFromDOM() {
    // Sincronizza la competizione dal <select>
    const compSelect = this.getCompetitionSelectEl();
    if (compSelect && compSelect.value) {
      const found = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === compSelect.value);
      if (found) this.currentCompetition = found;
    }

    // Sincronizza la rarità attiva dai tab
    const activeRarityBtn = document.querySelector('[data-scarcity].active, [data-rarity].active');
    if (activeRarityBtn) {
      const r = (activeRarityBtn.dataset.scarcity || activeRarityBtn.dataset.rarity || '').toLowerCase();
      if (r) this.currentScarcity = r;
    }

    // Sincronizza la strategia attiva dai tab
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
    if (loginBtnText) loginBtnText.textContent = '⏳ Sincronizzazione GW & Opta...';
    this.notify('⏳ Connessione a Sorare in corso: scarico carte Pro, Gameweek e statistiche Opta...');

    try {
      const data = await SorareAPI.fetchCurrentUserGallery(forceRefresh);
      if (data && data.cards) {
        this.user = data.user;
        this.cards = data.cards;
        this.gameweeks = data.gameweeks || [];
        this.selectedGwIndex = 0;

        this.updateGalleryCounters();

        if (loginBtnText) {
          loginBtnText.textContent = `✅ @${this.user?.nickname || 'Manager'} (${this.cards.length} carte Pro)`;
        }
        if (loginBtn) {
          loginBtn.classList.add('connected');
          loginBtn.disabled = false;
        }

        this.syncStateFromDOM();
        this.renderGwSelector();
        const activeGw = this.gameweeks[this.selectedGwIndex];
        const gwBadge = activeGw ? ` • ${activeGw.label} (${activeGw.dateRangeText})` : '';
        this.notify(`✅ Sincronizzate ${this.cards.length} carte Pro${gwBadge}`);
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
    const select = this.getCompetitionSelectEl();
    if (!select) return;

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
        const parent = target.parentElement;
        if (parent) {
          parent.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
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
        const parent = target.parentElement;
        if (parent) {
          parent.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
        }
        target.classList.add('active');
        this.currentStrategy = val;
        this.runOptimizer();
      });
    });

    // Listener universale per qualsiasi pulsante Genera / Ottimizza nel DOM
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
      this.notify('⚠️ Nessuna carta sincronizzata: clicca prima su Connetti Sorare in alto a destra.', true);
      this.renderEmptyState();
      return;
    }

    if (!window.OptimizerEngine) {
      this.notify('❌ Errore caricamento OptimizerEngine (ricarica con Cmd+Shift+R)', true);
      return;
    }

    this.syncStateFromDOM();
    const selectedGw = this.gameweeks[this.selectedGwIndex] || null;
    const lineups = OptimizerEngine.buildCascadePortfolio(
      this.cards,
      this.currentCompetition,
      this.currentScarcity,
      this.currentStrategy,
      selectedGw
    );

    this.updateGalleryCounters(lineups.length);
    this.renderLineups(lineups, selectedGw);
  },

  renderLineups(lineups, selectedGw) {
    const grid =
      document.getElementById('lineups-grid') ||
      document.getElementById('lineups-container') ||
      document.getElementById('results-grid') ||
      document.querySelector('.lineups-grid');

    const summary =
      document.getElementById('portfolio-summary') ||
      document.getElementById('results-summary') ||
      document.querySelector('.portfolio-summary');

    const gwInfoStr = selectedGw ? ` • ${selectedGw.label} (${selectedGw.dateRangeText})` : '';
    const rarityCards = this.cards.filter(c => c.scarcity === this.currentScarcity.toLowerCase());
    const inSeasonInRarity = rarityCards.filter(c => c.isInSeason).length;

    if (!lineups || lineups.length === 0) {
      const reasonMsg = `⚠️ 0 formazioni generate per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr} — Hai ${rarityCards.length} carte ${this.currentScarcity.toUpperCase()} (${inSeasonInRarity} In-Season 26/27).`;
      this.notify(reasonMsg, true);

      if (summary) {
        summary.innerHTML = reasonMsg;
      }
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state">
            <p><strong>${reasonMsg}</strong></p>
            <p>Verifica di avere almeno 1 GK, 1 DEF, 1 MID, 1 FWD e 1 EXTRA eleggibili (con il requisito In-Season richiesto dal torneo).</p>
          </div>
        `;
      }
      return;
    }

    const totalPortfolioPoints = lineups.reduce((acc, l) => acc + l.totalProjected, 0);
    this.notify(`✅ Generate ${lineups.length} formazioni per ${this.currentCompetition.name} (${this.currentScarcity.toUpperCase()})${gwInfoStr} • Totale: ${totalPortfolioPoints} pt`);

    if (summary) {
      summary.innerHTML = `
        Galleria: <strong>${this.cards.length} carte Pro</strong> (${rarityCards.length} ${this.currentScarcity.toUpperCase()}) •
        <strong>${lineups.length} Formazioni Ottimizzate</strong> per <strong>${this.currentCompetition.name}</strong>${gwInfoStr} •
        Proiezione Totale: <strong>${totalPortfolioPoints} pt</strong>
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
    const grid =
      document.getElementById('lineups-grid') ||
      document.getElementById('lineups-container') ||
      document.getElementById('results-grid') ||
      document.querySelector('.lineups-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>Connetti il tuo account <strong>Sorare</strong> in alto a destra per sincronizzare automaticamente tutte le tue carte e calcolare le formazioni ottimali per ogni torneo.</p>
        </div>
      `;
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
