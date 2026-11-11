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
    if (!compSelect || !CONFIG.OFFICIAL_COMPETITIONS) return;

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

    compSelect.appendChild(inSeasonGroup);
    compSelect.appendChild(classicGroup);

    compSelect.value = this.state.selectedCompetitionId;
  },

  bindEvents() {
    // 1. Cambio competizione
    const compSelect = document.getElementById('comp-select');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        this.state.selectedCompetitionId = e.target.value;
        if (this.state.cards.length > 0) this.runOptimizer();
      });
    }

    // 2. Selettore Rarità
    const scarcityContainer = document.getElementById('scarcity-selector') || document.querySelector('.rarity-selector');
    if (scarcityContainer) {
      scarcityContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button, .pill-btn');
        if (!btn) return;
        scarcityContainer.querySelectorAll('button, .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.selectedScarcity = (btn.dataset.scarcity || btn.textContent || 'limited').trim().toLowerCase();
        if (this.state.cards.length > 0) this.runOptimizer();
      });
    }

    // 3. Selettore Strategia Algoritmo
    const strategyContainer = document.getElementById('strategy-selector') || document.querySelector('.strategy-selector');
    if (strategyContainer) {
      strategyContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button, .pill-btn');
        if (!btn) return;
        strategyContainer.querySelectorAll('button, .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const text = btn.textContent.toLowerCase();
        this.state.selectedStrategy = text.includes('ceiling') ? 'ceiling' : 'floor';
        if (this.state.cards.length > 0) this.runOptimizer();
      });
    }

    // 4. Genera Portfolio
    const runBtn = document.getElementById('run-optimizer-btn') || document.querySelector('.btn-generate');
    if (runBtn) {
      runBtn.addEventListener('click', () => this.runOptimizer());
    }

    // 5. Pulsante Demo (intercetta sia id che classi che click su testo)
    document.querySelectorAll('#demo-btn, #demo-mode-btn, .btn-demo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.loadDemoGallery();
      });
    });

    // Fallback generico per qualsiasi bottone con scritto "demo"
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.toLowerCase().includes('demo')) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.loadDemoGallery();
        });
      }
    });
  },

  async checkOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      if (window.SorareAPI && SorareAPI.handleOAuthCallback) {
        const token = await SorareAPI.handleOAuthCallback(code);
        if (token) await this.loadUserGallery();
      }
      return;
    }

    const existingToken = localStorage.getItem('sorare_access_token');
    if (existingToken && window.SorareAPI && SorareAPI.fetchCurrentUserGallery) {
      await this.loadUserGallery();
    }
  },

  async loadUserGallery() {
    try {
      const data = await SorareAPI.fetchCurrentUserGallery();
      if (!data) return;

      this.state.user = data.user;
      this.state.cards = data.cards;
      this.state.isDemo = false;

      this.updateNavbarUser(data.user.nickname || data.user.slug);
      this.updateTelemetry();
      this.runOptimizer();
    } catch (err) {
      console.error('Errore caricamento galleria utente:', err);
    }
  },

  loadDemoGallery() {
    this.state.isDemo = true;
    this.state.user = { nickname: 'DemoManager', slug: 'demo' };
    this.state.cards = this.getMockDemoCards();

    this.updateNavbarUser('DemoManager (Simulazione)');
    this.updateTelemetry();
    this.runOptimizer();
  },

  updateNavbarUser(name) {
    const el = document.getElementById('login-btn-text') || document.querySelector('.btn-connect') || document.querySelector('.btn-login');
    if (el) {
      el.textContent = `👤 @${name}`;
    }
  },

  safeSetText(idOrSelector, text) {
    const el = document.getElementById(idOrSelector) || document.querySelector(idOrSelector);
    if (el) el.textContent = text;
  },

  updateTelemetry() {
    const total = this.state.cards.length;
    const inSeason = this.state.cards.filter(c => c.isInSeason).length;
    const starters = this.state.cards.filter(c => c.confirmedXi).length;

    this.safeSetText('stat-total-cards', total);
    this.safeSetText('stat-inseason-cards', inSeason);
    this.safeSetText('stat-starters', starters);

    // Supporto per i box dell'interfaccia corrente
    const statCards = document.querySelectorAll('.stat-card .stat-value, .metric-box .metric-val');
    if (statCards.length >= 3) {
      statCards[0].textContent = total;
      statCards[1].textContent = inSeason;
      statCards[2].textContent = starters;
    }
  },

  runOptimizer() {
    const comp = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === this.state.selectedCompetitionId);
    if (!comp) return;

    const lineups = OptimizerEngine.buildCascadePortfolio(
      this.state.cards,
      comp,
      this.state.selectedScarcity,
      this.state.selectedStrategy
    );

    this.safeSetText('stat-lineups-built', lineups.length);
    const statCards = document.querySelectorAll('.stat-card .stat-value, .metric-box .metric-val');
    if (statCards.length >= 4) {
      statCards[3].textContent = lineups.length;
    }

    this.renderLineups(lineups, comp);
  },

  renderLineups(lineups, comp) {
    const container = document.getElementById('lineups-output') || 
                      document.getElementById('lineups-container') || 
                      document.querySelector('.lineups-grid') || 
                      document.querySelector('.main-content-area');

    if (!container) return;

    if (lineups.length === 0) {
      container.innerHTML = `
        <div style="background:#111418; border:1px solid #2d3540; border-radius:12px; padding:32px; text-align:center; margin-top:20px; color:#e1e7ec;">
          <div style="font-size:36px; margin-bottom:12px;">⚠️</div>
          <h3 style="color:#d4af37; margin-bottom:8px;">Nessuna squadra completabile per ${comp.name}</h3>
          <p style="color:#8b9baa; font-size:14px; max-width:550px; margin:0 auto;">
            I giocatori disponibili nel dataset per questo torneo (${comp.format}, rarità <strong>${this.state.selectedScarcity.toUpperCase()}</strong>) non sono sufficienti per formare un quintetto o un settennato valido con i ruoli richiesti.<br><br>
            👉 Prova a selezionare <strong>Premier League</strong>, <strong>LaLiga</strong> o <strong>All-Star Classic</strong> nel menu a tendina per vedere subito i team generati a cascata!
          </p>
        </div>
      `;
      return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:20px; margin-top:20px;">';
    lineups.forEach((team) => {
      html += `
        <div style="background:#12151b; border:1px solid #232936; border-radius:12px; padding:20px; box-shadow:0 8px 24px rgba(0,0,0,0.5);">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f2530; padding-bottom:12px; margin-bottom:16px;">
            <div>
              <span style="background:#d4af37; color:#0b0d11; font-weight:800; font-size:12px; padding:4px 10px; border-radius:6px; text-transform:uppercase;">${team.rankLabel}</span>
              <span style="color:#8b9baa; font-size:13px; margin-left:10px;">${comp.name} • Formato <strong>${team.format}</strong></span>
            </div>
            <div>
              <span style="color:#8b9baa; font-size:13px;">Proiezione Opta: </span>
              <span style="color:#d4af37; font-weight:800; font-size:18px;">${team.totalProjected} pts</span>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:12px;">
            ${team.starters.map(p => `
              <div style="background:#181d24; border:1px solid ${p.isCaptain ? '#d4af37' : '#262d38'}; border-radius:10px; padding:12px; text-align:center; position:relative;">
                ${p.isCaptain ? '<div style="position:absolute; top:-8px; right:8px; background:#d4af37; color:#0b0d11; font-size:9px; font-weight:900; padding:2px 6px; border-radius:4px;">CAP (+50%)</div>' : ''}
                <div style="font-size:11px; font-weight:800; color:#8b9baa; text-transform:uppercase; margin-bottom:4px;">${p.slotRole}</div>
                <div style="font-size:14px; font-weight:700; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                <div style="font-size:11px; color:#6b7c8f; margin-bottom:8px;">${p.club}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #222933; padding-top:6px; font-size:11px;">
                  <span style="background:${p.isInSeason ? '#0f3822' : '#2b2313'}; color:${p.isInSeason ? '#38d37a' : '#d4af37'}; padding:2px 5px; border-radius:4px; font-weight:700;">${p.isInSeason ? 'IN-SEASON' : 'CLASSIC'}</span>
                  <span style="color:#d4af37; font-weight:800;">${p.projectedScore}p</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
  },

  getMockDemoCards() {
    return [
      // Premier League (In-Season & Classic)
      { id: 'p1', name: 'Erling Haaland', club: 'Manchester City', leagueSlug: 'premier-league-gb-eng', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.15, optaAas: 62, xgXa: 0.95, confirmedXi: true },
      { id: 'p2', name: 'Bukayo Saka', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.12, optaAas: 58, xgXa: 0.80, confirmedXi: true },
      { id: 'p3', name: 'William Saliba', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 54, xgXa: 0.20, confirmedXi: true },
      { id: 'p4', name: 'David Raya', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 50, xgXa: 0.05, confirmedXi: true },
      { id: 'p5', name: 'Declan Rice', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 56, xgXa: 0.35, confirmedXi: true },
      { id: 'p6', name: 'Cole Palmer', club: 'Chelsea', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: true, isUefaContender: true, powerMultiplier: 1.15, optaAas: 60, xgXa: 0.90, confirmedXi: true },
      { id: 'p7', name: 'Virgil van Dijk', club: 'Liverpool', leagueSlug: 'premier-league-gb-eng', position: 'DEF', scarcity: 'limited', isInSeason: false, isU23: false, isUefaChampions: true, powerMultiplier: 1.05, optaAas: 58, xgXa: 0.25, confirmedXi: true },

      // LaLiga (In-Season & Classic)
      { id: 'l1', name: 'Kylian Mbappé', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.19, optaAas: 65, xgXa: 1.10, confirmedXi: true },
      { id: 'l2', name: 'Vinicius Jr', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.16, optaAas: 63, xgXa: 0.98, confirmedXi: true },
      { id: 'l3', name: 'Jude Bellingham', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: true, isUefaChampions: true, powerMultiplier: 1.18, optaAas: 62, xgXa: 0.85, confirmedXi: true },
      { id: 'l4', name: 'Thibaut Courtois', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 52, xgXa: 0.05, confirmedXi: true },
      { id: 'l5', name: 'Lamine Yamal', club: 'Barcelona', leagueSlug: 'laliga-es', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: true, isUefaChampions: true, powerMultiplier: 1.20, optaAas: 66, xgXa: 1.05, confirmedXi: true },
      { id: 'l6', name: 'Pau Cubarsí', club: 'Barcelona', leagueSlug: 'laliga-es', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: true, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 53, xgXa: 0.15, confirmedXi: true },
      { id: 'l7', name: 'Pedri', club: 'Barcelona', leagueSlug: 'laliga-es', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.14, optaAas: 61, xgXa: 0.70, confirmedXi: true },
      { id: 'l8', name: 'Antonio Rüdiger', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.08, optaAas: 52, xgXa: 0.10, confirmedXi: true },

      // MLS
      { id: 'm1', name: 'Lionel Messi', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.20, optaAas: 70, xgXa: 1.25, confirmedXi: true },
      { id: 'm2', name: 'Luis Suárez', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.10, optaAas: 55, xgXa: 0.75, confirmedXi: true },
      { id: 'm3', name: 'Sergio Busquets', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.08, optaAas: 58, xgXa: 0.30, confirmedXi: true },
      { id: 'm4', name: 'Jordi Alba', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.10, optaAas: 54, xgXa: 0.40, confirmedXi: true },
      { id: 'm5', name: 'Drake Callender', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.05, optaAas: 48, xgXa: 0.05, confirmedXi: true }
    ];
  }
};

window.loadDemoGallery = () => App.loadDemoGallery();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
