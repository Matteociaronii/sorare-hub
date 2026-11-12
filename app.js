// SorareHub - Main Application Controller
const App = {
  state: {
    cards: [],
    user: null,
    selectedCompetitionId: 'premier_league_in_season',
    selectedScarcity: 'limited',
    selectedStrategy: 'floor',
    isDemo: false
  },

  init() {
    this.populateCompetitionsMenu();
    this.bindEvents();
    this.checkOAuthCallback();
  },

  populateCompetitionsMenu() {
    const compSelect = document.getElementById('comp-select');
    if (!compSelect || typeof CONFIG === 'undefined' || !CONFIG.OFFICIAL_COMPETITIONS) return;

    compSelect.innerHTML = '';

    const inSeasonGroup = document.createElement('optgroup');
    inSeasonGroup.label = '— IN-SEASON (SO5: Min 4 In-Season, Mono-Lega) —';

    const classicGroup = document.createElement('optgroup');
    classicGroup.label = '— CLASSIC (SO7: 7 Titolari, Tutte le Annate) —';

    CONFIG.OFFICIAL_COMPETITIONS.forEach(comp => {
      const option = document.createElement('option');
      option.value = comp.id;
      option.textContent = comp.name;

      if (comp.format === 'SO5') {
        inSeasonGroup.appendChild(option);
      } else {
        classicGroup.appendChild(option);
      }
    });

    if (inSeasonGroup.children.length > 0) compSelect.appendChild(inSeasonGroup);
    if (classicGroup.children.length > 0) compSelect.appendChild(classicGroup);

    const exists = CONFIG.OFFICIAL_COMPETITIONS.some(c => c.id === this.state.selectedCompetitionId);
    if (exists) {
      compSelect.value = this.state.selectedCompetitionId;
    } else if (CONFIG.OFFICIAL_COMPETITIONS.length > 0) {
      this.state.selectedCompetitionId = CONFIG.OFFICIAL_COMPETITIONS[0].id;
      compSelect.value = this.state.selectedCompetitionId;
    }
  },

  bindEvents() {
    const compSelect = document.getElementById('comp-select');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        this.state.selectedCompetitionId = e.target.value;
        if (this.state.cards.length > 0) this.runOptimizer();
      });
    }

    const scarcityContainer = document.getElementById('scarcity-selector');
    if (scarcityContainer) {
      scarcityContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;
        scarcityContainer.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.selectedScarcity = btn.dataset.scarcity;
        if (this.state.cards.length > 0) this.runOptimizer();
      });
    }

    const strategyContainer = document.getElementById('strategy-selector');
    if (strategyContainer) {
      strategyContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;
        strategyContainer.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.selectedStrategy = btn.dataset.strategy;
        if (this.state.cards.length > 0) this.runOptimizer();
      });
    }

    const runBtn = document.getElementById('run-optimizer-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        if (this.state.cards.length === 0) {
          this.loadDemoGallery();
        } else {
          this.runOptimizer();
        }
      });
    }

    const demoBtn = document.getElementById('demo-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => this.loadDemoGallery());
    }
  },

  async checkOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      const token = await SorareAPI.handleOAuthCallback(code);
      if (token) {
        await this.loadUserGallery();
      }
      return;
    }

    const existingToken = localStorage.getItem('sorare_access_token');
    if (existingToken) {
      await this.loadUserGallery();
    }
  },

  async loadUserGallery() {
    const loginBtnText = document.getElementById('login-btn-text');
    if (loginBtnText) loginBtnText.textContent = 'Caricamento Gallery...';

    try {
      const data = await SorareAPI.fetchCurrentUserGallery();
      if (!data || !data.cards) return;

      this.state.user = data.user;
      this.state.cards = data.cards;
      this.state.isDemo = false;

      this.updateNavbarUser(data.user.nickname || data.user.slug);
      this.updateTelemetry();
      this.runOptimizer();
    } catch (err) {
      console.error('Errore caricamento galleria utente:', err);
      if (loginBtnText) loginBtnText.textContent = 'Connetti Sorare';
    }
  },

  loadDemoGallery() {
    this.state.isDemo = true;
    this.state.user = { nickname: 'DemoManager', slug: 'demo' };
    this.state.cards = (window.SorareAPI && SorareAPI.getDemoGallery)
      ? SorareAPI.getDemoGallery()
      : this.getMockDemoCards();

    this.updateNavbarUser('DemoManager (Simulazione)');
    this.updateTelemetry();
    this.runOptimizer();
  },

  updateNavbarUser(name) {
    const loginBtnText = document.getElementById('login-btn-text');
    if (loginBtnText) {
      loginBtnText.textContent = `👤 @${name}`;
    }
  },

  updateTelemetry() {
    const proCards = this.state.cards.filter(c => c.scarcity !== 'common');
    const total = proCards.length;
    const inSeason = proCards.filter(c => c.isInSeason).length;
    const starters = proCards.filter(c => c.confirmedXi).length;

    const totalEl = document.getElementById('stat-total-cards');
    const inSeasonEl = document.getElementById('stat-inseason-cards');
    const startersEl = document.getElementById('stat-starters');
    const slugEl = document.getElementById('stat-user-slug');

    if (totalEl) totalEl.textContent = total;
    if (inSeasonEl) inSeasonEl.textContent = inSeason;
    if (startersEl) startersEl.textContent = starters;
    if (slugEl) {
      slugEl.textContent = this.state.user?.nickname ? `@${this.state.user.nickname}` : 'Demo';
    }
  },

  runOptimizer() {
    if (typeof CONFIG === 'undefined' || !CONFIG.OFFICIAL_COMPETITIONS) return;
    const comp = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === this.state.selectedCompetitionId)
      || CONFIG.OFFICIAL_COMPETITIONS[0];
    if (!comp) return;

    const lineups = OptimizerEngine.buildCascadePortfolio(
      this.state.cards,
      comp,
      this.state.selectedScarcity,
      this.state.selectedStrategy
    );

    const builtEl = document.getElementById('stat-lineups-built');
    if (builtEl) builtEl.textContent = lineups.length;
    this.renderLineups(lineups, comp);
  },

  renderLineups(lineups, comp) {
    const container = document.getElementById('lineups-output');
    if (!container) return;

    if (!lineups || lineups.length === 0) {
      container.innerHTML = `
        <div class="empty-placeholder carbon-card">
          <div class="placeholder-icon">⚠️</div>
          <h2>Nessuna formazione completabile per questa competizione</h2>
          <p>Non hai abbastanza carte <strong>${this.state.selectedScarcity.toUpperCase()}</strong> per formare un team in <strong>${comp.name}</strong> rispettando i requisiti (formato ${comp.format}, min. ${comp.inSeasonRequired} In-Season).</p>
        </div>
      `;
      return;
    }

    container.innerHTML = lineups.map(team => `
      <div class="team-card carbon-card" style="padding: 18px 20px;">
        <div class="team-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-dim); padding-bottom:10px;">
          <div>
            <span class="team-rank-badge" style="background:rgba(234,179,8,0.15); color:var(--gold-light); border:1px solid rgba(234,179,8,0.3); padding:3px 8px; border-radius:5px; font-size:11px; font-weight:700; margin-right:8px;">${team.rankLabel}</span>
            <span class="team-meta" style="font-size:13px; font-weight:600; color:var(--text-primary);">${comp.name} • ${team.format}</span>
          </div>
          <div class="team-score">
            <span class="score-label" style="font-size:11px; color:var(--text-secondary); margin-right:6px;">Proiezione Opta:</span>
            <span class="score-value text-gold" style="font-family:var(--font-mono); font-size:16px; font-weight:700;">${team.totalProjected} pts</span>
          </div>
        </div>
        <div class="pitch-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px;">
          ${team.starters.map(p => `
            <div class="player-slot ${p.isCaptain ? 'is-captain' : ''}" style="background:var(--bg-elevated); border:1px solid ${p.isCaptain ? 'var(--gold-base)' : 'var(--border-mid)'}; border-radius:8px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:10px; font-weight:800; color:var(--cyan);">${p.slotRole}</span>
                ${p.isCaptain ? '<span style="font-size:9px; font-weight:800; background:var(--gold-base); color:#090a0d; padding:2px 5px; border-radius:4px;">CAP</span>' : ''}
              </div>
              <div style="font-size:13px; font-weight:700; color:#fff; margin-bottom:2px;">${p.name}</div>
              <div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px;">${p.club}</div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
                <span style="color:${p.isInSeason ? 'var(--gold-light)' : 'var(--text-muted)'}; font-weight:600;">${p.isInSeason ? 'IN-SEASON' : 'CLASSIC'}</span>
                <span style="font-family:var(--font-mono); font-weight:700; color:var(--emerald);">${p.projectedScore} pt</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  },

  getMockDemoCards() {
    return [
      { id: 'p1', name: 'Erling Haaland', club: 'Manchester City', leagueSlug: 'premier-league-gb-eng', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.15, optaAas: 62, xgXa: 0.95, confirmedXi: true },
      { id: 'p2', name: 'Bukayo Saka', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.12, optaAas: 58, xgXa: 0.80, confirmedXi: true },
      { id: 'p3', name: 'William Saliba', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 54, xgXa: 0.20, confirmedXi: true },
      { id: 'p4', name: 'David Raya', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 50, xgXa: 0.05, confirmedXi: true },
      { id: 'p5', name: 'Declan Rice', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 56, xgXa: 0.35, confirmedXi: true }
    ];
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
