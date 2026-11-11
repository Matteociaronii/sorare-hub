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
    compSelect.innerHTML = '';
    CONFIG.OFFICIAL_COMPETITIONS.forEach(comp => {
      const opt = document.createElement('option');
      opt.value = comp.id;
      opt.textContent = comp.name;
      compSelect.appendChild(opt);
    });
  }

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
    });
  });

  if (compSelect) {
    compSelect.addEventListener('change', () => {
      if (currentGallery.length) executeOptimization();
    });
  }

  // 3. Gestione Click Pulsante Login OAuth
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      loginBtn.innerHTML = '<span>Reindirizzamento...</span>';
      SorareAPI.startOAuthFlow();
    });
  }

  // 4. Modalità Demo
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      currentGallery = SorareAPI.getDemoGallery();
      updateTelemetryUI('Demo Mode Pro', currentGallery);
      executeOptimization();
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

  // 5. Verifica Ritorno da Sorare (OAuth Callback)
  const token = await SorareAPI.handleOAuthCallback();
  const storedToken = token || localStorage.getItem('sorare_access_token');

  if (storedToken) {
    if (loginBtn) {
      loginBtn.innerHTML = '<span>Caricamento Gallery...</span>';
    }
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
    }
  }

  function updateTelemetryUI(userLabel, cards) {
    const totalEl = document.getElementById('stat-total-cards');
    const slugEl = document.getElementById('stat-user-slug');
    const inSeasonEl = document.getElementById('stat-inseason-cards');
    const startersEl = document.getElementById('stat-starters');

    if (totalEl) totalEl.textContent = cards.length;
    if (slugEl) slugEl.textContent = userLabel;
    if (inSeasonEl) inSeasonEl.textContent = cards.filter(c => c.isInSeason).length;
    if (startersEl) startersEl.textContent = cards.filter(c => c.confirmedXi).length;
  }

  function executeOptimization() {
    const compId = compSelect ? compSelect.value : CONFIG.OFFICIAL_COMPETITIONS[0].id;
    const competition = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === compId) || CONFIG.OFFICIAL_COMPETITIONS[0];

    const lineups = OptimizerEngine.buildCascadePortfolio(
      currentGallery,
      competition,
      selectedScarcity,
      selectedStrategy
    );

    const builtEl = document.getElementById('stat-lineups-built');
    if (builtEl) builtEl.textContent = lineups.length;
    renderLineups(lineups, competition);
  }

  function renderLineups(lineups, competition) {
    if (!lineupsOutput) return;

    if (!lineups.length) {
      lineupsOutput.innerHTML = `
        <div class="empty-placeholder carbon-card">
          <div class="placeholder-icon">⚠️</div>
          <h2>Carte Insufficienti per ${competition.name}</h2>
          <p>Non ci sono abbastanza carte eleggibili (richieste minimo ${competition.inSeasonRequired} In-Season) nella rarità ${selectedScarcity.toUpperCase()} per completare la formazione.</p>
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
                <div class="player-name">${p.name}</div>
                <div class="player-club">${p.club}</div>
                <div class="metrics-box">
                  <div class="metric-row"><span>Opta AAS:</span><span>${p.optaAas} pt</span></div>
                  <div class="metric-row"><span>xG + xA:</span><span>${p.xgXa}</span></div>
                  <div class="metric-row"><span>Proiezione EV:</span><span>${p.projectedScore} pt</span></div>
                </div>
              </div>
              <div class="badges-list">
                ${p.badges.map(b => `<span class="tactical-badge">${b}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }
});
