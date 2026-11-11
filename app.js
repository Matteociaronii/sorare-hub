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

  notify(msg, isError = false) {
    let box = document.getElementById('debug-status-banner');
    if (!box) {
      box = document.createElement('div');
      box.id = 'debug-status-banner';
      box.style.position = 'fixed';
      box.style.bottom = '20px';
      box.style.left = '50%';
      box.style.transform = 'translateX(-50%)';
      box.style.padding = '12px 24px';
      box.style.borderRadius = '8px';
      box.style.fontSize = '14px';
      box.style.fontWeight = 'bold';
      box.style.zIndex = '99999';
      box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
      document.body.appendChild(box);
    }
    box.style.display = 'block';
    box.style.background = isError ? '#8b0000' : '#1e3a29';
    box.style.color = isError ? '#ffbaba' : '#69f0ae';
    box.style.border = isError ? '1px solid #ff4d4d' : '1px solid #00e676';
    box.textContent = msg;

    if (!isError) {
      setTimeout(() => { if (box) box.style.display = 'none'; }, 5000);
    }
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
    const compSelect = document.getElementById('comp-select');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        this.state.selectedCompetitionId = e.target.value;
        if (this.state.cards.length > 0) this.runOptimizer();
      });
    }

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

    const runBtn = document.getElementById('run-optimizer-btn') || document.querySelector('.btn-generate');
    if (runBtn) {
      runBtn.addEventListener('click', () => this.runOptimizer());
    }

    document.querySelectorAll('#demo-btn, #demo-mode-btn, .btn-demo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.loadDemoGallery();
      });
    });
  },

  async checkOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      this.notify('🔄 Autenticazione in corso: scambio token...');
      if (window.SorareAPI && SorareAPI.handleOAuthCallback) {
        const token = await SorareAPI.handleOAuthCallback(code);
        if (token) {
          window.history.replaceState({}, document.title, window.location.pathname);
          this.notify('✅ Token ricevuto! Caricamento carte...');
          await this.loadUserGallery();
        } else {
          this.notify('❌ Errore durante lo scambio token. Controlla il Worker.', true);
        }
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
      this.notify('📥 Sincronizzazione galleria Sorare...');
      const data = await SorareAPI.fetchCurrentUserGallery();
      if (!data) {
        this.notify('⚠️ Nessun dato ricevuto da Sorare', true);
        return;
      }

      this.state.user = data.user;
      this.state.cards = data.cards;
      this.state.isDemo = false;

      this.updateNavbarUser(data.user.nickname || data.user.slug);
      this.updateTelemetry();
      this.notify(`🎉 Benvenuto @${data.user.nickname || data.user.slug}! ${data.cards.length} carte caricate.`);
      this.runOptimizer();
    } catch (err) {
      console.error('Errore caricamento galleria:', err);
      this.notify(`❌ Errore Galleria: ${err.message}`, true);
    }
  },

  loadDemoGallery() {
    this.state.isDemo = true;
    this.state.user = { nickname: 'DemoManager', slug: 'demo' };
    this.state.cards = this.getMockDemoCards();

    this.updateNavbarUser('DemoManager (Simulazione)');
    this.updateTelemetry();
    this.runOptimizer();
    this.notify('🎮 Modalità Demo attiva');
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
    this.safeSetText('stat-user-slug', `@${this.state.user?.nickname || this.state.user?.slug || 'Manager'}`);

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
            Le carte disponibili per questa competizione (${comp.format}, rarità <strong>${this.state.selectedScarcity.toUpperCase()}</strong>) non sono sufficienti per formare un team completo con tutti i ruoli richiesti.<br><br>
            Prova a cambiare rarità o selezionare un'altra competizione dal menu in alto.
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
      { id: 'p1', name: 'Erling Haaland', club: 'Manchester City', leagueSlug: 'premier-league-gb-eng', position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.15, optaAas: 62, xgXa: 0.95, confirmedXi: true },
      { id: 'p2', name: 'Bukayo Saka', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.12, optaAas: 58, xgXa: 0.80, confirmedXi: true },
      { id: 'p3', name: 'William Saliba', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 54, xgXa: 0.20, confirmedXi: true },
      { id: 'p4', name: 'David Raya', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 50, xgXa: 0.05, confirmedXi: true },
      { id: 'p5', name: 'Declan Rice', club: 'Arsenal', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, isUefaChampions: true, powerMultiplier: 1.10, optaAas: 56, xgXa: 0.35, confirmedXi: true },
      { id: 'p6', name: 'Cole Palmer', club: 'Chelsea', leagueSlug: 'premier-league-gb-eng', position: 'MID', scarcity: 'limited', isInSeason: true, isU23: true, isUefaContender: true, powerMultiplier: 1.15, optaAas: 60, xgXa: 0.90, confirmedXi: true },
      { id: 'p7', name: 'Virgil van Dijk', club: 'Liverpool', leagueSlug: 'premier-league-gb-eng', position: 'DEF', scarcity: 'limited', isInSeason: false, isU23: false, isUefaChampions: true, powerMultiplier: 1.05, optaAas: 58, xgXa: 0.25, confirmedXi: true }
    ];
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
