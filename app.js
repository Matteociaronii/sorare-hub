// SorareHub - Core Logic & Visual Engine
const App = {
  userCards: [],
  currentUser: null,
  activeRarity: 'limited',
  activeStrategy: 'floor',

  init() {
    this.checkSession();
  },

  notify(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      background: ${isError ? '#7f1d1d' : '#181b22'};
      color: #fff;
      padding: 9px 14px;
      border-radius: 6px;
      border: 1px solid ${isError ? '#ef4444' : '#f59e0b'};
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },

  setRarity(rarity) {
    this.activeRarity = rarity;
    ['limited', 'rare', 'super_rare', 'unique'].forEach(r => {
      const btn = document.getElementById(`btn-rarity-${r}`);
      if (btn) btn.classList.toggle('active', r === rarity);
    });
  },

  setStrategy(strat) {
    this.activeStrategy = strat;
    const btnF = document.getElementById('btn-strat-floor');
    const btnC = document.getElementById('btn-strat-ceiling');
    if (btnF) btnF.classList.toggle('active', strat === 'floor');
    if (btnC) btnC.classList.toggle('active', strat === 'ceiling');
  },

  async checkSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    let token = localStorage.getItem('sorare_access_token');
    if (code) {
      token = await SorareAPI.handleOAuthCallback(code);
    }
    if (token) {
      await this.initUserGallery();
    }
  },

  async initUserGallery() {
    try {
      const data = await SorareAPI.fetchCurrentUserGallery();
      if (!data) return;

      this.currentUser = data.user;
      this.userCards = data.cards || [];

      // Filtra le limited (che costituiscono la tua vera collezione giocabile)
      const limiteds = this.userCards.filter(c => c.scarcity === 'limited');
      const inSeasons = limiteds.filter(c => c.isInSeason);
      const starters = limiteds.filter(c => c.confirmedXi);

      // Aggiorna indicatori identici allo screenshot
      const btnLogin = document.getElementById('btn-login');
      if (btnLogin) {
        btnLogin.textContent = `@${this.currentUser.nickname || this.currentUser.slug}`;
        btnLogin.style.background = '#181b22';
        btnLogin.style.color = '#f59e0b';
        btnLogin.style.border = '1px solid #f59e0b';
      }

      document.getElementById('stat-cards-count').textContent = limiteds.length;
      document.getElementById('stat-status-sub').textContent = 'Sincronizzato Live';
      document.getElementById('stat-inseason-count').textContent = inSeasons.length;
      document.getElementById('stat-confirmed-count').textContent = starters.length;
      document.getElementById('gallery-count-badge').textContent = limiteds.length;

      this.notify(`✅ Sincronizzazione completata: ${limiteds.length} Limited pronte!`);
    } catch (err) {
      console.error(err);
      this.notify(`Errore: ${err.message}`, true);
    }
  },

  switchView(view) {
    const optView = document.getElementById('optimizer-view');
    const galView = document.getElementById('gallery-view');
    const btnOpt = document.getElementById('tab-optimizer');
    const btnGal = document.getElementById('tab-gallery');

    if (view === 'gallery') {
      optView.classList.add('hidden');
      galView.classList.remove('hidden');
      btnOpt.classList.remove('active');
      btnGal.classList.add('active');
      this.filterGallery();
    } else {
      galView.classList.add('hidden');
      optView.classList.remove('hidden');
      btnGal.classList.remove('active');
      btnOpt.classList.add('active');
    }
  },

  // Generatore Carte Grafiche
  buildCardHtml(card, isSlot = false) {
    const fallback = 'https://assets.sorare.com/placeholder.png';
    const cap = card.isCaptain ? '<div style="position:absolute;bottom:4px;left:4px;background:#f59e0b;color:#000;font-weight:900;border-radius:3px;padding:1px 5px;font-size:9px;">(C)</div>' : '';
    const slotStyle = isSlot ? 'style="width: 135px; flex-shrink: 0;"' : '';

    return `
      <div class="sorare-card-box ${card.scarcity}" ${slotStyle}>
        <div style="position:relative; width:100%; aspect-ratio:0.75; background:#0b0c10; overflow:hidden;">
          <span style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.85);color:#fff;padding:2px 5px;border-radius:3px;font-size:10px;font-weight:800;">${card.position}</span>
          <span style="position:absolute;top:4px;right:4px;background:#10b981;color:#fff;padding:2px 5px;border-radius:3px;font-size:9px;font-weight:800;">+${card.bonusPct}%</span>
          <img src="${card.pictureUrl || fallback}" alt="${card.name}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${fallback}'" />
          ${cap}
        </div>
        <div style="padding: 8px; background:#12141a;">
          <div style="font-weight:700; font-size:12px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.name}</div>
          <div style="font-size:10px; color:#8c93a4; margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.club}</div>
          <div style="display:flex; justify-content:space-between; background:#0b0c10; padding:4px 6px; border-radius:4px; font-size:10px;">
            <div><span style="color:#64748b; font-size:8px; display:block;">L5</span><strong>${card.l5}</strong></div>
            <div><span style="color:#64748b; font-size:8px; display:block;">L15</span><strong>${card.l15}</strong></div>
            <div><span style="color:#64748b; font-size:8px; display:block;">AAS</span><strong style="color:#10b981;">${card.optaAas}</strong></div>
          </div>
        </div>
      </div>
    `;
  },

  filterGallery() {
    const search = (document.getElementById('gallery-search')?.value || '').toLowerCase();
    const pool = document.getElementById('gallery-filter-pool')?.value || 'limited_only';
    const pos = document.getElementById('gallery-filter-pos')?.value || 'ALL';
    const sort = document.getElementById('gallery-sort')?.value || 'l15-desc';

    let list = this.userCards.filter(c => {
      if (pool === 'limited_only' && c.scarcity !== 'limited') return false;
      if (pool === 'common_only' && (c.scarcity !== 'common' && c.scarcity !== 'custom')) return false;

      const matchSearch = c.name.toLowerCase().includes(search) || c.club.toLowerCase().includes(search);
      const matchPos = pos === 'ALL' || c.position === pos;
      return matchSearch && matchPos;
    });

    list.sort((a, b) => {
      if (sort === 'l15-desc') return (b.l15 || 0) - (a.l15 || 0);
      if (sort === 'l5-desc') return (b.l5 || 0) - (a.l5 || 0);
      if (sort === 'bonus-desc') return b.bonusPct - a.bonusPct;
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      return 0;
    });

    const grid = document.getElementById('cards-grid');
    if (!grid) return;
    if (list.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#8c93a4;padding:40px;">Nessuna carta trovata con questi parametri.</div>';
      return;
    }
    grid.innerHTML = list.map(c => this.buildCardHtml(c)).join('');
  },

  generateOptimizedLineups() {
    const competition = document.getElementById('competition-select')?.value || 'PREMIER_LEAGUE_IN_SEASON';
    const isInSeasonReq = competition.includes('IN_SEASON');

    // Filtra per la rarità attiva scelta nei bottoni (es. solo Limited)
    let pool = this.userCards.filter(c => c.scarcity === this.activeRarity);

    if (pool.length < 5) {
      this.notify(`Servono almeno 5 carte ${this.activeRarity} per generare un lineup!`, true);
      return;
    }

    // Risoluzione a cascata (fino a 5 formazioni senza riuso della stessa carta)
    const usedIds = new Set();
    const lineups = [];

    // Funzione di punteggio in base alla strategia (Floor AAS vs Ceiling)
    const scoreFn = (card) => {
      const base = this.activeStrategy === 'floor' ? (card.l15 * 0.7 + card.optaAas * 0.3) : (card.l5 * 0.6 + card.l15 * 0.4);
      return base * card.powerMultiplier;
    };

    for (let r = 0; r < 5; r++) {
      const avail = pool.filter(c => !usedIds.has(c.id));
      const gk = avail.filter(c => c.position === 'GK').sort((a, b) => scoreFn(b) - scoreFn(a))[0];
      const def = avail.filter(c => c.position === 'DEF' && c.id !== gk?.id).sort((a, b) => scoreFn(b) - scoreFn(a))[0];
      const mid = avail.filter(c => c.position === 'MID' && c.id !== gk?.id && c.id !== def?.id).sort((a, b) => scoreFn(b) - scoreFn(a))[0];
      const fwd = avail.filter(c => c.position === 'FWD' && c.id !== gk?.id && c.id !== def?.id && c.id !== mid?.id).sort((a, b) => scoreFn(b) - scoreFn(a))[0];

      if (!gk || !def || !mid || !fwd) break;

      const taken = new Set([gk.id, def.id, mid.id, fwd.id]);
      const extra = avail.filter(c => !taken.has(c.id) && c.position !== 'GK').sort((a, b) => scoreFn(b) - scoreFn(a))[0];

      if (!extra) break;

      const team = [gk, def, mid, fwd, extra];
      team.forEach(c => usedIds.add(c.id));

      // Assegna capitano al miglior punteggio
      let bestCap = team[0];
      team.forEach(c => {
        if (scoreFn(c) > scoreFn(bestCap)) bestCap = c;
      });
      bestCap.isCaptain = true;

      const totalProjected = team.reduce((acc, c) => acc + (scoreFn(c) * (c.isCaptain ? 1.2 : 1)), 0);

      lineups.push({
        rank: r + 1,
        competition: competition.replace(/_/g, ' '),
        projected: Math.round(totalProjected),
        cards: team
      });
    }

    document.getElementById('stat-teams-count').textContent = lineups.length;

    const container = document.getElementById('lineups-results-container');
    if (!container) return;

    if (lineups.length === 0) {
      container.innerHTML = '<div style="background:#12141a;border:1px solid #242834;border-radius:8px;padding:24px;text-align:center;color:#8c93a4;">Nessuna formazione completa componibile (manca portiere o ruoli chiave).</div>';
      return;
    }

    container.innerHTML = lineups.map(l => `
      <div style="background:#12141a; border:1px solid #242834; border-radius:10px; padding:16px; margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <strong style="color:#fff; font-size:14px;">TEAM #${l.rank} • ${l.competition}</strong>
            <span style="color:#8c93a4; font-size:11px; margin-left:8px;">Zero carte sovrapposte</span>
          </div>
          <div style="background:#181b22; border:1px solid var(--accent-gold); padding:5px 12px; border-radius:6px; font-weight:800; font-size:13px; color:var(--text-gold);">
            Previsto: ${l.projected} pts
          </div>
        </div>
        <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:6px;">
          ${l.cards.map(c => this.buildCardHtml(c, true)).join('')}
        </div>
      </div>
    `).join('');
  },

  runDemoMode() {
    this.notify('Caricamento modalità Demo simulata...');
    // Genera 20 carte fake dimostrative
    const mockCards = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'].flatMap((pos, idx) => [
      {
        id: `mock_${pos}_${idx}`,
        name: `${pos} Pro 2026`,
        club: 'Demo FC',
        position: pos,
        scarcity: 'limited',
        isInSeason: true,
        confirmedXi: true,
        l5: 58,
        l15: 55,
        bonusPct: 5,
        powerMultiplier: 1.05,
        optaAas: 48,
        pictureUrl: 'https://assets.sorare.com/placeholder.png'
      }
    ]);
    this.userCards = mockCards;
    this.initUserGallery();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
