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
    this.injectTooltipStyles();
    this.populateCompetitionsMenu();
    this.bindEvents();
    this.checkOAuthCallback();
    this.notify('✅ SorareHub Pronto');
  },

  injectTooltipStyles() {
    if (document.getElementById('sh-tactical-tooltip-css')) return;
    const style = document.createElement('style');
    style.id = 'sh-tactical-tooltip-css';
    style.textContent = `
      .sh-help-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgba(234, 179, 8, 0.14);
        border: 1px solid rgba(234, 179, 8, 0.45);
        color: var(--gold-light, #fde047);
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        user-select: none;
        transition: all 0.18s ease;
        flex-shrink: 0;
      }
      .sh-help-btn:hover,
      .sh-help-btn.is-open {
        background: var(--gold-base, #eab308);
        color: #090a0d;
        transform: scale(1.08);
      }
      .sh-tactical-popover {
        display: none;
        position: absolute;
        left: 10px;
        right: 10px;
        bottom: calc(100% + 8px);
        z-index: 250;
        background: #0d1017;
        border: 1px solid rgba(234, 179, 8, 0.55);
        border-radius: 10px;
        padding: 11px 12px;
        font-size: 11.5px;
        line-height: 1.45;
        color: #f3f4f6;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.78);
        pointer-events: auto;
      }
      .player-slot:hover .sh-tactical-popover.hover-enabled,
      .sh-tactical-popover.is-open {
        display: block;
      }
      .sh-tactical-popover::after {
        content: '';
        position: absolute;
        top: 100%;
        right: 18px;
        border-width: 6px;
        border-style: solid;
        border-color: rgba(234, 179, 8, 0.55) transparent transparent transparent;
      }
    `;
    document.head.appendChild(style);
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

    // Gestione apertura/chiusura tooltip '?' su Touch (iPad/iPhone) e Click
    document.addEventListener('click', (e) => {
      const helpBtn = e.target.closest('.sh-help-btn');
      if (helpBtn) {
        e.stopPropagation();
        const slot = helpBtn.closest('.player-slot');
        const popover = slot ? slot.querySelector('.sh-tactical-popover') : null;
        const wasOpen = popover && popover.classList.contains('is-open');

        document.querySelectorAll('.sh-tactical-popover.is-open').forEach(el => el.classList.remove('is-open'));
        document.querySelectorAll('.sh-help-btn.is-open').forEach(el => el.classList.remove('is-open'));

        if (popover && !wasOpen) {
          popover.classList.add('is-open');
          helpBtn.classList.add('is-open');
        }
        return;
      }

      if (!e.target.closest('.sh-tactical-popover')) {
        document.querySelectorAll('.sh-tactical-popover.is-open').forEach(el => el.classList.remove('is-open'));
        document.querySelectorAll('.sh-help-btn.is-open').forEach(el => el.classList.remove('is-open'));
      }
    });
  },

  async checkOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      this.notify('🔄 Verifica autorizzazione Sorare...');
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
    this.notify('📥 Sincronizzazione dati reali Opta/SO5...');

    try {
      const data = await SorareAPI.fetchCurrentUserGallery();
      if (!data || !data.cards) return;

      this.state.user = data.user;
      this.state.cards = data.cards;
      this.state.isDemo = false;

      this.updateNavbarUser(data.user.nickname || data.user.slug);
      this.updateTelemetry();
      this.runOptimizer();
      this.notify(`✅ Galleria sincronizzata (${data.cards.length} carte)`);
    } catch (err) {
      console.error('Errore caricamento galleria utente:', err);
      if (loginBtnText) loginBtnText.textContent = 'Connetti Sorare';
      this.notify('❌ Errore caricamento galleria: ' + err.message, true);
    }
  },

  loadDemoGallery() {
    this.state.isDemo = true;
    this.state.user = { nickname: 'DemoManager', slug: 'demo' };
    this.state.cards = this.getMockDemoCards();

    this.updateNavbarUser('DemoManager (Simulazione)');
    this.updateTelemetry();
    this.runOptimizer();
    this.notify('🧪 Modalità Demo attiva');
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
    const realStarters = proCards.filter(c => c.confirmedXi).length;

    const totalEl = document.getElementById('stat-total-cards');
    const inSeasonEl = document.getElementById('stat-inseason-cards');
    const startersEl = document.getElementById('stat-starters');
    const slugEl = document.getElementById('stat-user-slug');

    if (totalEl) totalEl.textContent = total;
    if (inSeasonEl) inSeasonEl.textContent = inSeason;
    if (startersEl) startersEl.textContent = realStarters;
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
      <div class="team-card carbon-card" style="padding: 18px 20px; overflow: visible;">
        <div class="team-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border-dim); padding-bottom:10px;">
          <div>
            <span class="team-rank-badge" style="background:rgba(234,179,8,0.15); color:var(--gold-light); border:1px solid rgba(234,179,8,0.3); padding:3px 8px; border-radius:5px; font-size:11px; font-weight:700; margin-right:8px;">${team.rankLabel}</span>
            <span class="team-meta" style="font-size:13px; font-weight:600; color:var(--text-primary);">${comp.name} • ${team.format}</span>
            ${team.lastResortCount > 0 ? `<span style="margin-left:8px; font-size:10px; font-weight:700; color:#f87171; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); padding:2px 6px; border-radius:4px;">⚠️ ${team.lastResortCount} Ultima Spiaggia</span>` : ''}
          </div>
          <div class="team-score">
            <span class="score-label" style="font-size:11px; color:var(--text-secondary); margin-right:6px;">Proiezione EV:</span>
            <span class="score-value text-gold" style="font-family:var(--font-mono); font-size:16px; font-weight:700;">${team.totalProjected} pts</span>
          </div>
        </div>
        <div class="pitch-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:10px; overflow: visible;">
          ${team.starters.map(p => {
            const borderColor = p.isCaptain
              ? 'var(--gold-base)'
              : (p.isLastResort ? 'rgba(239,68,68,0.45)' : 'var(--border-mid)');
            const oppText = p.hasUpcomingGame
              ? `${p.isHome ? 'vs' : '@'} ${p.opponentName}`
              : 'Nessun match GW';

            return `
              <div class="player-slot ${p.isCaptain ? 'is-captain' : ''}" style="position:relative; background:var(--bg-elevated); border:1px solid ${borderColor}; border-radius:8px; padding:12px;">
                <div class="sh-tactical-popover">${p.matchupInsight || 'Analisi tattica non disponibile.'}</div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:4px;">
                  <span style="font-size:10px; font-weight:800; color:var(--cyan);">${p.slotRole}</span>
                  <div style="display:flex; align-items:center; gap:5px;">
                    ${p.isCaptain ? '<span style="font-size:9px; font-weight:800; background:var(--gold-base); color:#090a0d; padding:2px 5px; border-radius:4px;">CAP +50%</span>' : ''}
                    ${p.isLastResort ? '<span style="font-size:9px; font-weight:800; background:rgba(239,68,68,0.2); color:#fca5a5; padding:2px 5px; border-radius:4px;">RISERVA</span>' : ''}
                    <button type="button" class="sh-help-btn" aria-label="Analisi partita ${p.name}" title="Tocca per analisi partita">?</button>
                  </div>
                </div>

                <div style="font-size:13px; font-weight:700; color:#fff; margin-bottom:2px;">${p.name}</div>
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:2px;">${p.club}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-bottom:8px;">${oppText}</div>

                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.28); border-radius:5px; padding:4px 7px; margin-bottom:7px; font-family:var(--font-mono); font-size:10px;">
                  <span style="color:var(--text-secondary);">L15: <strong style="color:#fff;">${p.l15 || 0}</strong></span>
                  <span style="color:var(--text-secondary);">L5: <strong style="color:${(p.l5 || 0) >= (p.l15 || 0) ? 'var(--emerald)' : '#fbbf24'};">${p.l5 || 0}</strong></span>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
                  <span style="color:${p.isInSeason ? 'var(--gold-light)' : 'var(--text-muted)'}; font-weight:600;">${p.isInSeason ? 'IN-SEASON' : 'CLASSIC'}</span>
                  <span style="font-family:var(--font-mono); font-weight:700; color:var(--emerald);">${p.projectedScore} pt</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  },

  getMockDemoCards() {
    return [
      {
        id: 'p1', name: 'Erling Haaland', club: 'Manchester City', clubSlug: 'manchester-city', leagueSlug: 'premier-league-gb-eng',
        position: 'FWD', scarcity: 'limited', isInSeason: true, isU23: false, l5: 68.4, l15: 63.2, avgAas: 24.5, avgDecisive: 43.9,
        maxRecentScore: 94, stdDev: 16.2, playedCount: 5, starterCount: 5, avgMins: 88, availabilityTier: 'starter',
        confirmedXi: true, isLastResort: false, hasUpcomingGame: true, isHome: true, opponentName: 'Brighton', opponentSlug: 'brighton',
        tacticalTraits: { setPiece: false, aerial: true, ballWinner: false, clinical: true, cleanSheets: 0, goals: 4, assists: 1 },
        bonusPct: 12, powerMultiplier: 1.12
      },
      {
        id: 'p2', name: 'Bukayo Saka', club: 'Arsenal', clubSlug: 'arsenal', leagueSlug: 'premier-league-gb-eng',
        position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, l5: 65.0, l15: 61.5, avgAas: 36.2, avgDecisive: 28.8,
        maxRecentScore: 86, stdDev: 11.4, playedCount: 5, starterCount: 5, avgMins: 86, availabilityTier: 'starter',
        confirmedXi: true, isLastResort: false, hasUpcomingGame: true, isHome: true, opponentName: 'Wolves', opponentSlug: 'wolves',
        tacticalTraits: { setPiece: true, aerial: false, ballWinner: false, clinical: true, cleanSheets: 0, goals: 2, assists: 3 },
        bonusPct: 10, powerMultiplier: 1.10
      },
      {
        id: 'p3', name: 'William Saliba', club: 'Arsenal', clubSlug: 'arsenal', leagueSlug: 'premier-league-gb-eng',
        position: 'DEF', scarcity: 'limited', isInSeason: true, isU23: false, l5: 59.2, l15: 56.8, avgAas: 34.0, avgDecisive: 25.2,
        maxRecentScore: 76, stdDev: 8.5, playedCount: 5, starterCount: 5, avgMins: 90, availabilityTier: 'starter',
        confirmedXi: true, isLastResort: false, hasUpcomingGame: true, isHome: true, opponentName: 'Wolves', opponentSlug: 'wolves',
        tacticalTraits: { setPiece: false, aerial: true, ballWinner: true, clinical: false, cleanSheets: 3, goals: 0, assists: 0 },
        bonusPct: 8, powerMultiplier: 1.08
      },
      {
        id: 'p4', name: 'David Raya', club: 'Arsenal', clubSlug: 'arsenal', leagueSlug: 'premier-league-gb-eng',
        position: 'GK', scarcity: 'limited', isInSeason: true, isU23: false, l5: 55.4, l15: 53.0, avgAas: 22.0, avgDecisive: 33.4,
        maxRecentScore: 72, stdDev: 9.1, playedCount: 5, starterCount: 5, avgMins: 90, availabilityTier: 'starter',
        confirmedXi: true, isLastResort: false, hasUpcomingGame: true, isHome: true, opponentName: 'Wolves', opponentSlug: 'wolves',
        tacticalTraits: { setPiece: false, aerial: false, ballWinner: false, clinical: false, cleanSheets: 3, goals: 0, assists: 0 },
        bonusPct: 8, powerMultiplier: 1.08
      },
      {
        id: 'p5', name: 'Declan Rice', club: 'Arsenal', clubSlug: 'arsenal', leagueSlug: 'premier-league-gb-eng',
        position: 'MID', scarcity: 'limited', isInSeason: true, isU23: false, l5: 60.8, l15: 58.9, avgAas: 39.5, avgDecisive: 21.3,
        maxRecentScore: 78, stdDev: 7.4, playedCount: 5, starterCount: 5, avgMins: 90, availabilityTier: 'starter',
        confirmedXi: true, isLastResort: false, hasUpcomingGame: true, isHome: true, opponentName: 'Wolves', opponentSlug: 'wolves',
        tacticalTraits: { setPiece: true, aerial: false, ballWinner: true, clinical: false, cleanSheets: 0, goals: 1, assists: 1 },
        bonusPct: 9, powerMultiplier: 1.09
      }
    ];
  },

  notify(msg, isError = false) {
    let banner = document.getElementById('sh-toast-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sh-toast-banner';
      Object.assign(banner.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '9999',
        padding: '12px 18px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '700',
        fontFamily: 'Inter, sans-serif',
        boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
        transition: 'opacity 0.25s ease'
      });
      document.body.appendChild(banner);
    }

    banner.style.background = isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)';
    banner.style.color = '#090a0d';
    banner.textContent = msg;
    banner.style.opacity = '1';

    clearTimeout(this._notifyTimer);
    this._notifyTimer = setTimeout(() => {
      banner.style.opacity = '0';
    }, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
