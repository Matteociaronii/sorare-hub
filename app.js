// SorareHub - Main Application Controller
document.addEventListener('DOMContentLoaded', async () => {
  let currentGallery = [];
  let selectedScarcity = 'limited';
  let selectedStrategy = 'floor';

  const compSelect = document.getElementById('comp-select');
  const loginBtn = document.getElementById('login-btn');
  const demoBtn = document.getElementById('demo-btn');
  const runBtn = document.getElementById('run-optimizer-btn');
  const lineupsOutput = document.getElementById('lineups-output');

  // 1. Popola selettore competizioni ufficiali Sorare
  if (compSelect && CONFIG.OFFICIAL_COMPETITIONS) {
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
      const opt = document.createElement('option');
      opt.value = comp.id;
      opt.textContent = comp.name;
      compSelect.appendChild(opt);
    });
  }
      const option = document.createElement('option');
      option.value = comp.id;
      option.textContent = comp.name;

  // 2. Selettori Rarità e Strategia
  document.querySelectorAll('#scarcity-selector .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#scarcity-selector .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedScarcity = btn.dataset.scarcity;
      if (currentGallery.length) executeOptimization();
    });
  });

  document.querySelectorAll('#strategy-selector .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#strategy-selector .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStrategy = btn.dataset.strategy;
      if (currentGallery.length) executeOptimization();
      if (comp.format === 'SO5') {
        inSeasonGroup.appendChild(option);
      } else {
        classicGroup.appendChild(option);
      }
});
  });

  if (compSelect) {
    compSelect.addEventListener('change', () => {
      if (currentGallery.length) executeOptimization();
    });
  }
    compSelect.appendChild(inSeasonGroup);
    compSelect.appendChild(classicGroup);

  // 3. Gestione Click Pulsante Login OAuth
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      loginBtn.innerHTML = '<span>Reindirizzamento...</span>';
      SorareAPI.startOAuthFlow();
    });
  }
    compSelect.value = this.state.selectedCompetitionId;
  },

  // 4. Modalità Demo
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      currentGallery = SorareAPI.getDemoGallery();
      updateTelemetryUI('Demo Mode Pro', currentGallery);
      executeOptimization();
    });
  }
  bindEvents() {
    const compSelect = document.getElementById('comp-select');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        this.state.selectedCompetitionId = e.target.value;
        if (this.state.cards.length > 0) this.runOptimizer();
      });
    }

  if (runBtn) {
    runBtn.addEventListener('click', () => {
      if (!currentGallery.length) {
        currentGallery = SorareAPI.getDemoGallery();
        updateTelemetryUI('Demo Mode Pro', currentGallery);
      }
      executeOptimization();
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

  // 5. Verifica Ritorno da Sorare (OAuth Callback)
  const token = await SorareAPI.handleOAuthCallback();
  const storedToken = token || localStorage.getItem('sorare_access_token');
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

  if (storedToken) {
    if (loginBtn) {
      loginBtn.innerHTML = '<span>Caricamento Gallery...</span>';
    // Se abbiamo già un token salvato, carichiamo la galleria
    const existingToken = localStorage.getItem('sorare_access_token');
    if (existingToken) {
      await this.loadUserGallery();
}
  },

  async loadUserGallery() {
try {
const data = await SorareAPI.fetchCurrentUserGallery();
      if (data && data.cards) {
        currentGallery = data.cards;
        updateTelemetryUI(`@${data.user.nickname || data.user.slug}`, currentGallery);
        if (loginBtn) {
          loginBtn.innerHTML = '<span>Connesso</span>';
          loginBtn.classList.remove('btn-gold');
          loginBtn.classList.add('btn-secondary');
        }
        executeOptimization();
      }
    } catch (e) {
      console.error(e);
      if (loginBtn) loginBtn.innerHTML = '<span>Connetti Sorare</span>';
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
  }
  },

  function updateTelemetryUI(userLabel, cards) {
    const totalEl = document.getElementById('stat-total-cards');
    const slugEl = document.getElementById('stat-user-slug');
    const inSeasonEl = document.getElementById('stat-inseason-cards');
    const startersEl = document.getElementById('stat-starters');
  loadDemoGallery() {
    this.state.isDemo = true;
    this.state.user = { nickname: 'DemoManager', slug: 'demo' };
    this.state.cards = this.getMockDemoCards();

    if (totalEl) totalEl.textContent = cards.length;
    if (slugEl) slugEl.textContent = userLabel;
    if (inSeasonEl) inSeasonEl.textContent = cards.filter(c => c.isInSeason).length;
    if (startersEl) startersEl.textContent = cards.filter(c => c.confirmedXi).length;
  }
    this.updateNavbarUser('DemoManager (Simulazione)');
    this.updateTelemetry();
    this.runOptimizer();
  },

  function executeOptimization() {
    const compId = compSelect ? compSelect.value : CONFIG.OFFICIAL_COMPETITIONS[0].id;
    const competition = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === compId) || CONFIG.OFFICIAL_COMPETITIONS[0];
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
      currentGallery,
      competition,
      selectedScarcity,
      selectedStrategy
      this.state.cards,
      comp,
      this.state.selectedScarcity,
      this.state.selectedStrategy
);

    const builtEl = document.getElementById('stat-lineups-built');
    if (builtEl) builtEl.textContent = lineups.length;
    renderLineups(lineups, competition);
  }
    document.getElementById('stat-lineups-built').textContent = lineups.length;
    this.renderLineups(lineups, comp);
  },

  function renderLineups(lineups, competition) {
    if (!lineupsOutput) return;
  renderLineups(lineups, comp) {
    const container = document.getElementById('lineups-output');
    if (!container) return;

    if (!lineups.length) {
      lineupsOutput.innerHTML = `
    if (lineups.length === 0) {
      container.innerHTML = `
       <div class="empty-placeholder carbon-card">
         <div class="placeholder-icon">⚠️</div>
          <h2>Carte Insufficienti per ${competition.name}</h2>
          <p>Non ci sono abbastanza carte eleggibili (richieste minimo ${competition.inSeasonRequired} In-Season) nella rarità ${selectedScarcity.toUpperCase()} per completare la formazione.</p>
          <h2>Nessuna formazione completabile per questa competizione</h2>
          <p>Non hai abbastanza carte <strong>${this.state.selectedScarcity.toUpperCase()}</strong> per formare un team in <strong>${comp.name}</strong> rispettando i requisiti (formato ${comp.format}, min. ${comp.inSeasonRequired} In-Season).</p>
       </div>
     `;
return;
}

    lineupsOutput.innerHTML = lineups.map(lineup => `
      <div class="lineup-block carbon-card">
        <div class="lineup-header">
          <div class="lineup-title-group">
            <span class="team-rank-badge">${lineup.rankLabel}</span>
            <h3>${competition.name}</h3>
          </div>
          <div class="lineup-meta">
            <span class="meta-pill">In-Season: <strong class="text-emerald">${lineup.inSeasonCount}/${lineup.starters.length}</strong></span>
            <span class="meta-pill">Proiezione Totale: <strong class="text-gold">${lineup.totalProjected} pt</strong></span>
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
        </div>

        <div class="players-grid ${lineup.format === 'SO7' ? 'so7-grid' : ''}">
          ${lineup.starters.map(p => `
            <div class="player-card ${p.isCaptain ? 'captain-card' : ''}">
              <div>
                <div class="slot-header">
                  <span class="pos-tag">${p.slotRole} ${p.isCaptain ? '© CAP' : ''}</span>
                  <span class="season-tag ${p.isInSeason ? 'in-season' : 'classic'}">
                    ${p.isInSeason ? 'IN-SEASON' : 'CLASSIC'} (+${p.bonusPct}%)
                  </span>
                </div>
          <div class="pitch-container">
            ${team.starters.map(p => `
              <div class="player-slot ${p.isCaptain ? 'is-captain' : ''}">
                ${p.isCaptain ? '<span class="captain-badge">CAP (+50%)</span>' : ''}
                <div class="player-role-tag">${p.slotRole}</div>
               <div class="player-name">${p.name}</div>
               <div class="player-club">${p.club}</div>
                <div class="metrics-box">
                  <div class="metric-row"><span>Opta AAS:</span><span>${p.optaAas} pt</span></div>
                  <div class="metric-row"><span>xG + xA:</span><span>${p.xgXa}</span></div>
                  <div class="metric-row"><span>Proiezione EV:</span><span>${p.projectedScore} pt</span></div>
                <div class="player-stats">
                  <span class="stat-pill ${p.isInSeason ? 'pill-inseason' : 'pill-classic'}">${p.isInSeason ? 'IN-SEASON' : 'CLASSIC'}</span>
                  <span class="stat-pts">${p.projectedScore}p</span>
               </div>
             </div>
              <div class="badges-list">
                ${p.badges.map(b => `<span class="tactical-badge">${b}</span>`).join('')}
              </div>
            </div>
          `).join('')}
            `).join('')}
          </div>
       </div>
      </div>
    `).join('');
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
