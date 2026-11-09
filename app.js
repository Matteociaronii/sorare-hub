// SorareHub - Main UI Controller
document.addEventListener('DOMContentLoaded', async () => {
  let currentGallery = [];
  let selectedScarcity = 'limited';
  let selectedStrategy = 'floor';

  const compSelect = document.getElementById('comp-select');
  const loginBtn = document.getElementById('login-btn');
  const demoBtn = document.getElementById('demo-btn');
  const runBtn = document.getElementById('run-optimizer-btn');
  const slugInput = document.getElementById('slug-input');
  const slugLoadBtn = document.getElementById('slug-load-btn');
  const lineupsOutput = document.getElementById('lineups-output');

  // 1. Popola Menu Competizioni Ufficiali Sorare
  CONFIG.OFFICIAL_COMPETITIONS.forEach(comp => {
    const opt = document.createElement('option');
    opt.value = comp.id;
    opt.textContent = comp.name;
    compSelect.appendChild(opt);
  });

  // 2. Gestione Selettori Rarità e Strategia
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

  compSelect.addEventListener('change', () => {
    if (currentGallery.length) executeOptimization();
  });

  // 3. Controllo Callback OAuth Sorare
  await SorareAPI.handleOAuthCallback();

  // 4. Event Listeners Login, Slug e Demo
  loginBtn.addEventListener('click', () => {
    SorareAPI.startOAuthFlow();
  });

  demoBtn.addEventListener('click', () => {
    currentGallery = SorareAPI.getDemoGallery();
    updateTelemetryUI('Gallery Demo Pro (21 Carte)', currentGallery);
    executeOptimization();
  });

  slugLoadBtn.addEventListener('click', async () => {
    const slug = slugInput.value.trim();
    if (!slug) return;
    slugLoadBtn.textContent = 'Caricamento...';
    try {
      currentGallery = await SorareAPI.fetchGalleryBySlug(slug);
      updateTelemetryUI(`@${slug}`, currentGallery);
      executeOptimization();
    } catch (e) {
      alert(e.message);
    } finally {
      slugLoadBtn.textContent = 'Carica Gallery';
    }
  });

  runBtn.addEventListener('click', () => {
    if (!currentGallery.length) {
      currentGallery = SorareAPI.getDemoGallery();
      updateTelemetryUI('Gallery Demo Attivata', currentGallery);
    }
    executeOptimization();
  });

  function updateTelemetryUI(userLabel, cards) {
    document.getElementById('stat-total-cards').textContent = cards.length;
    document.getElementById('stat-user-slug').textContent = userLabel;
    document.getElementById('stat-inseason-cards').textContent = cards.filter(c => c.isInSeason).length;
    document.getElementById('stat-starters').textContent = cards.filter(c => c.confirmedXi).length;
  }

  function executeOptimization() {
    const compId = compSelect.value;
    const competition = CONFIG.OFFICIAL_COMPETITIONS.find(c => c.id === compId) || CONFIG.OFFICIAL_COMPETITIONS[0];

    const lineups = OptimizerEngine.buildCascadePortfolio(
      currentGallery,
      competition,
      selectedScarcity,
      selectedStrategy
    );

    document.getElementById('stat-lineups-built').textContent = lineups.length;
    renderLineups(lineups, competition);
  }

  function renderLineups(lineups, competition) {
    if (!lineups.length) {
      lineupsOutput.innerHTML = `
        <div class="empty-placeholder carbon-card">
          <div class="placeholder-icon">⚠️</div>
          <h2>Carte Insufficienti per ${competition.name}</h2>
          <p>Non ci sono abbastanza carte eleggibili (o almeno ${competition.inSeasonRequired} carte In-Season) nella rarità selezionata per completare una formazione valida.</p>
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
                    ${p.isInSeason ? '26/27 IN-SEASON' : 'CLASSIC'} (+${p.bonusPct}%)
                  </span>
                </div>
                <div class="player-name">${p.name}</div>
                <div class="player-club">${p.club} • Titolarità ${p.starterProb}%</div>
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

        ${lineup.bench.length ? `
          <div class="bench-section">
            <div class="bench-title">PANCHINA SMART (2 SLOT • REGOLA BASE FLOOR 35 PT GARANTITA SUBENTRANTI)</div>
            <div class="bench-grid">
              ${lineup.bench.map((sub, idx) => `
                <div class="player-card">
                  <div class="slot-header">
                    <span class="pos-tag">SUB ${idx + 1} (${sub.position})</span>
                    <span class="season-tag ${sub.isInSeason ? 'in-season' : 'classic'}">+${sub.bonusPct}%</span>
                  </div>
                  <div class="player-name">${sub.name} (${sub.club})</div>
                  <div class="metrics-box" style="margin-top:6px;margin-bottom:0;">
                    <div class="metric-row"><span>Floor Subentrante:</span><span>35.0 pt</span></div>
                    <div class="metric-row"><span>Proiezione Attesa:</span><span>${sub.projectedScore} pt</span></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `).join('');
  }
});
