// SorareHub - Controller con separazione Limited / Common
const App = {
  userCards: [],
  currentUser: null,

  init() {
    this.checkSession();
  },

  notify(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      background: ${isError ? '#7f1d1d' : '#1e293b'};
      color: #fff;
      padding: 8px 14px;
      margin-top: 6px;
      border-radius: 6px;
      border: 1px solid ${isError ? '#dc2626' : '#334155'};
      font-size: 12px;
      font-weight: 600;
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
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

      // Statistiche per rarità
      const limitedCards = this.userCards.filter(c => c.scarcity === 'limited');
      const commonCards = this.userCards.filter(c => c.scarcity === 'common' || c.scarcity === 'custom');

      // Update UI Header & Counters
      const userBadge = document.getElementById('user-badge');
      const userNick = document.getElementById('user-nickname');
      if (userBadge && userNick) {
        userNick.textContent = `@${this.currentUser.nickname || this.currentUser.slug}`;
        userBadge.classList.remove('hidden');
      }

      const elTot = document.getElementById('stat-cards-count');
      const elLim = document.getElementById('stat-limited-count');
      const elCom = document.getElementById('stat-common-count');
      const badgeCount = document.getElementById('gallery-count-badge');

      if (elTot) elTot.textContent = this.userCards.length;
      if (elLim) elLim.textContent = limitedCards.length;
      if (elCom) elCom.textContent = commonCards.length;
      if (badgeCount) badgeCount.textContent = limitedCards.length;

      this.notify(`Collezione caricata: ${limitedCards.length} Limited, ${commonCards.length} Common.`);

      if (!document.getElementById('gallery-view')?.classList.contains('hidden')) {
        this.filterGallery();
      }
    } catch (err) {
      console.error(err);
      this.notify(`Errore: ${err.message}`, true);
    }
  },

  switchView(viewName) {
    const optView = document.getElementById('optimizer-view');
    const galView = document.getElementById('gallery-view');
    const btnOpt = document.getElementById('tab-optimizer');
    const btnGal = document.getElementById('tab-gallery');

    if (viewName === 'gallery') {
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

  buildCardHtml(card, isSlot = false) {
    const fallback = 'https://assets.sorare.com/placeholder.png';
    const cap = card.isCaptain ? '<div style="position:absolute;bottom:4px;left:4px;background:#f59e0b;color:#000;font-weight:800;border-radius:3px;padding:1px 4px;font-size:9px;">(C)</div>' : '';
    const slotStyle = isSlot ? 'style="width: 130px; flex-shrink: 0;"' : '';

    return `
      <div class="sorare-card-box ${card.scarcity}" ${slotStyle}>
        <div style="position:relative; width:100%; aspect-ratio:0.75; background:#0a0c10; overflow:hidden;">
          <span style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.8);color:#fff;padding:2px 5px;border-radius:3px;font-size:10px;font-weight:700;">${card.position}</span>
          <span style="position:absolute;top:4px;right:4px;background:rgba(16,185,129,0.9);color:#fff;padding:2px 4px;border-radius:3px;font-size:9px;font-weight:700;">+${card.bonusPct}%</span>
          <img src="${card.pictureUrl || fallback}" alt="${card.name}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${fallback}'" />
          ${cap}
        </div>
        <div style="padding: 7px; background:#14171f;">
          <div style="font-weight:700; font-size:12px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.name}</div>
          <div style="font-size:10px; color:#8b949e; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.club}</div>
          <div style="display:flex; justify-content:space-between; background:#0b0d12; padding:3px 5px; border-radius:4px; font-size:10px;">
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
    const pos = document.getElementById('gallery-filter-pos')?.value || 'ALL';
    const pool = document.getElementById('gallery-filter-pool')?.value || 'limited_only';
    const sort = document.getElementById('gallery-sort')?.value || 'l15-desc';

    let list = this.userCards.filter(c => {
      // Filtro per gruppo di rarità
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
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#8b949e;padding:30px;">Nessuna carta trovata con questi filtri.</div>';
      return;
    }
    grid.innerHTML = list.map(c => this.buildCardHtml(c)).join('');
  },

  generateOptimizedLineups() {
    // ESCLUDI RIGOROSAMENTE LE COMMON: usa solo carte Limited
    const playablePool = this.userCards.filter(c => c.scarcity === 'limited');

    if (playablePool.length < 5) {
      this.notify('Servono almeno 5 carte Limited per schierare.', true);
      return;
    }

    const targetLineups = parseInt(document.getElementById('target-lineups')?.value || '3', 10);
    const tournament = document.getElementById('tournament-select')?.value || 'ALL_STAR';

    const usedIds = new Set();
    const lineups = [];

    for (let i = 0; i < targetLineups; i++) {
      const available = playablePool.filter(c => !usedIds.has(c.id));
      const gk = available.filter(c => c.position === 'GK').sort((a, b) => (b.l15 * b.powerMultiplier) - (a.l15 * a.powerMultiplier))[0];
      const def = available.filter(c => c.position === 'DEF' && c.id !== gk?.id).sort((a, b) => (b.l15 * b.powerMultiplier) - (a.l15 * a.powerMultiplier))[0];
      const mid = available.filter(c => c.position === 'MID' && c.id !== gk?.id && c.id !== def?.id).sort((a, b) => (b.l15 * b.powerMultiplier) - (a.l15 * a.powerMultiplier))[0];
      const fwd = available.filter(c => c.position === 'FWD' && c.id !== gk?.id && c.id !== def?.id && c.id !== mid?.id).sort((a, b) => (b.l15 * b.powerMultiplier) - (a.l15 * a.powerMultiplier))[0];

      if (!gk || !def || !mid || !fwd) break;

      const taken = new Set([gk.id, def.id, mid.id, fwd.id]);
      const extra = available.filter(c => !taken.has(c.id) && c.position !== 'GK').sort((a, b) => (b.l15 * b.powerMultiplier) - (a.l15 * a.powerMultiplier))[0];

      if (!extra) break;

      const squad = [gk, def, mid, fwd, extra];
      squad.forEach(c => usedIds.add(c.id));

      let bestCap = squad[0];
      squad.forEach(c => {
        if ((c.l15 * c.powerMultiplier) > (bestCap.l15 * bestCap.powerMultiplier)) {
          bestCap = c;
        }
      });
      bestCap.isCaptain = true;

      const totalProjected = squad.reduce((sum, c) => sum + (c.l15 * (c.isCaptain ? c.powerMultiplier * 1.2 : c.powerMultiplier)), 0);

      lineups.push({
        rank: i + 1,
        tournament: tournament,
        projectedScore: Math.round(totalProjected),
        cards: squad
      });
    }

    const container = document.getElementById('lineups-results-container');
    if (!container) return;
    if (lineups.length === 0) {
      container.innerHTML = '<div style="color:#8b949e;padding:16px;">Limited insufficienti per comporre formazioni complete con portiere.</div>';
      return;
    }

    container.innerHTML = lineups.map(l => `
      <div style="background:#15171e; border:1px solid #262a36; border-radius:8px; padding:14px; margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <strong style="color:#fff; font-size:14px;">Formazione #${l.rank} - ${l.tournament}</strong>
            <span style="color:#8b949e; font-size:11px; margin-left:8px;">5 Limited uniche</span>
          </div>
          <div style="background:#1c1f28; border:1px solid #363c4d; padding:4px 10px; border-radius:6px; font-weight:700; font-size:13px; color:#eab308;">
            Previsto: ${l.projectedScore} pts
          </div>
        </div>
        <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:6px;">
          ${l.cards.map(c => this.buildCardHtml(c, true)).join('')}
        </div>
      </div>
    `).join('');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
