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

    // Raggruppa per tipologia visiva
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
      runBtn.addEventListener('click', () => this.runOptimizer());
    }

    const demoBtn = document.getElementById('demo-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => this.loadDemoGallery());
    }
  },

  async checkOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // Se c'è un codice nell'URL, lo consumiamo e puliamo subito la barra degli indirizzi
    // per non rieseguire la richiesta ad ogni reload
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      const token = await SorareAPI.handleOAuthCallback(code);
      if (token) {
        await this.loadUserGallery();
      }
      return;
    }

    // Se abbiamo già un token salvato, carichiamo la galleria
    const existingToken = localStorage.getItem('sorare_access_token');
    if (existingToken) {
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
    const loginBtnText = document.getElementById('login-btn-text');
    if (loginBtnText) {
      loginBtnText.textContent = `👤 @${name}`;
    }
  },

  updateTelemetry() {
    const total = this.state.cards.length;
    const inSeason = this.state.cards.filter(c => c.isInSeason).length;
    const starters = this.state.cards.filter(c => c.confirmedXi).length;

    document.getElementById('stat-total-cards').textContent = total;
    document.getElementById('stat-inseason-cards').textContent = inSeason;
    document.getElementById('stat-starters').textContent = starters;
    document.getElementById('stat-user-slug').textContent = this.state.user?.nickname ? `@${this.state.user.nickname}` : 'Demo';
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

    document.getElementById('stat-lineups-built').textContent = lineups.length;
    this.renderLineups(lineups, comp);
  },

  renderLineups(lineups, comp) {
    const container = document.getElementById('lineups-output');
    if (!container) return;

    if (lineups.length === 0) {
      container.innerHTML = `
        <div class="empty-placeholder carbon-card">
          <div class="placeholder-icon">⚠️</div>
          <h2>Nessuna formazione completabile per questa competizione</h2>
          <p>Non hai abbastanza carte <strong>${this.state.selectedScarcity.toUpperCase()}</strong> per formare un team in <strong>${comp.name}</strong> rispettando i requisiti (formato ${comp.format}, min. ${comp.inSeasonRequired} In-Season).</p>
        </div>
      `;
      return;
    }

    let html = '';
    lineups.forEach((team) => {
      html += `
        <div class="team-card carbon-card">
          <div class="team-header">
            <div>
              <span class="team-rank-badge">${team.rankLabel}</span>
              <span class="team-meta">${comp.name} • ${team.format}</span>
            </div>
            <div class="team-score">
              <span class="score-label">Proiezione Opta:</span>
              <span class="score-value text-gold">${team.totalProjected} pts</span>
            </div>
          </div>

          <div class="pitch-container">
            ${team.starters.map(p => `
              <div class="player-slot ${p.isCaptain ? 'is-captain' : ''}">
                ${p.isCaptain ? '<span class="captain-badge">CAP (+50%)</span>' : ''}
                <div class="player-role-tag">${p.slotRole}</div>
                <div class="player-name">${p.name}</div>
                <div class="player-club">${p.club}</div>
                <div class="player-stats">
                  <span class="stat-pill ${p.isInSeason ? 'pill-inseason' : 'pill-classic'}">${p.isInSeason ? 'IN-SEASON' : 'CLASSIC'}</span>
                  <span class="stat-pts">${p.projectedScore}p</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  getMockDemoCards() {
    // Genera carte coerenti per testare tutte le nuove competizioni
    const mock = [
      // Premier League
      { id: 'p1', name: 'Erling Haaland', club: 'Manchester City', leagueSlug: 'premier-league-gb-eng', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.15, optaAas: 62, xgXa: 0.95, confirmedXi: true },
      { id: 'p2', name: 'Bukayo Saka', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.12, optaAas: 58, xgXa: 0.80, confirmedXi: true },
      { id: 'p3', name: 'William Saliba', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 54, xgXa: 0.20, confirmedXi: true },
      { id: 'p4', name: 'David Raya', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 50, xgXa: 0.05, confirmedXi: true },
      { id: 'p5', name: 'Declan Rice', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 56, xgXa: 0.35, confirmedXi: true },
      { id: 'p6', name: 'Cole Palmer', club: 'Chelsea', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: true, isUefaContender: true, powerMultiplier: 1.15, optaAas: 60, xgXa: 0.90, confirmedXi: true },
      { id: 'p7', name: 'Virgil van Dijk', club: 'Liverpool', leagueSlug: 'premier-league-gb-eng', position: 'DEF', scarcity: 'limited', isInSeason: false, isU23: false, isUefaChampions: true, powerMultiplier: 1.05, optaAas: 58, xgXa: 0.25, confirmedXi: true },

      // LaLiga
      { id: 'l1', name: 'Kylian Mbappé', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.19, optaAas: 65, xgXa: 1.10, confirmedXi: true },
      { id: 'l2', name: 'Vinicius Jr', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.16, optaAas: 63, xgXa: 0.98, confirmedXi: true },
      { id: 'l3', name: 'Jude Bellingham', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: true, isUefaChampions: true, powerMultiplier: 1.18, optaAas: 62, xgXa: 0.85, confirmedXi: true },
      { id: 'l4', name: 'Thibaut Courtois', club: 'Real Madrid', leagueSlug: 'laliga-es', position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 52, xgXa: 0.05, confirmedXi: true },
      { id: 'l5', name: 'Lamine Yamal', club: 'Barcelona', leagueSlug: 'laliga-es', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: true, isUefaChampions: true, powerMultiplier: 1.20, optaAas: 66, xgXa: 1.05, confirmedXi: true },
      { id: 'l6', name: 'Pau Cubarsí', club: 'Barcelona', leagueSlug: 'laliga-es', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: true, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 53, xgXa: 0.15, confirmedXi: true },
      { id: 'l7', name: 'Pedri', club: 'Barcelona', leagueSlug: 'laliga-es', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.14, optaAas: 61, xgXa: 0.70, confirmedXi: true },

      // MLS
      { id: 'm1', name: 'Lionel Messi', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.20, optaAas: 70, xgXa: 1.25, confirmedXi: true },
      { id: 'm2', name: 'Luis Suárez', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.10, optaAas: 55, xgXa: 0.75, confirmedXi: true },
      { id: 'm3', name: 'Sergio Busquets', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.08, optaAas: 58, xgXa: 0.30, confirmedXi: true },
      { id: 'm4', name: 'Jordi Alba', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.10, optaAas: 54, xgXa: 0.40, confirmedXi: true },
      { id: 'm5', name: 'Drake Callender', club: 'Inter Miami', leagueSlug: 'mls-us', position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, powerMultiplier: 1.05, optaAas: 48, xgXa: 0.05, confirmedXi: true }
    ];
    return mock;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
