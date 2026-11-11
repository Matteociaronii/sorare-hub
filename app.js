// SorareHub - Main Application Controller
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
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    toast.textContent = message;
    toast.style.cssText = `
      background: ${isError ? '#ef4444' : '#1e293b'};
      color: #fff;
      padding: 10px 16px;
      margin-top: 8px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      font-size: 13px;
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
      this.notify('🔄 Finalizzazione accesso Sorare...');
      token = await SorareAPI.handleOAuthCallback(code);
    }

    if (token) {
      await this.initUserGallery();
    }
  },

  async initUserGallery() {
    this.notify('📥 Connessione a Sorare in corso...');
    try {
      const data = await SorareAPI.fetchCurrentUserGallery();
      if (!data) return;

      this.currentUser = data.user;
      this.userCards = data.cards || [];

      // Aggiorna Header
      const userBadge = document.getElementById('user-badge');
      const userNick = document.getElementById('user-nickname');
      const btnLogin = document.getElementById('btn-login');

      if (userBadge && userNick) {
        userNick.textContent = `@${this.currentUser.nickname || this.currentUser.slug}`;
        userBadge.classList.remove('hidden');
      }
      if (btnLogin) {
        btnLogin.textContent = 'Ricarica Collezione';
      }

      // Aggiorna Contatori
      const countEl = document.getElementById('stat-cards-count');
      if (countEl) countEl.textContent = this.userCards.length;

      const badgeCount = document.getElementById('gallery-count-badge');
      if (badgeCount) badgeCount.textContent = this.userCards.length;

      this.notify(`✅ Collezione caricata: ${this.userCards.length} carte!`);

      // Se la galleria è aperta, fai il render
      if (document.getElementById('gallery-view') && !document.getElementById('gallery-view').classList.contains('hidden')) {
        this.filterGallery();
      }
    } catch (err) {
      console.error(err);
      this.notify(`❌ Errore Galleria: ${err.message}`, true);
    }
  },

  switchView(viewName) {
    const optView = document.getElementById('optimizer-view');
    const galView = document.getElementById('gallery-view');
    const btnOpt = document.getElementById('tab-optimizer');
    const btnGal = document.getElementById('tab-gallery');

    if (viewName === 'gallery') {
      if (optView) optView.classList.add('hidden');
      if (galView) galView.classList.remove('hidden');
      if (btnOpt) btnOpt.classList.remove('active');
      if (btnGal) btnGal.classList.add('active');
      this.filterGallery();
    } else {
      if (galView) galView.classList.add('hidden');
      if (optView) optView.classList.remove('hidden');
      if (btnGal) btnGal.classList.remove('active');
      if (btnOpt) btnOpt.classList.add('active');
    }
  },

  buildCardHtml(card, isSlot = false) {
    const fallback = 'https://assets.sorare.com/placeholder.png';
    const capBadge = card.isCaptain ? '<div style="position:absolute;bottom:6px;left:6px;background:#f59e0b;color:#000;font-weight:900;border-radius:4px;padding:1px 5px;font-size:10px;">(C)</div>' : '';
    const slotStyle = isSlot ? 'style="width: 140px; flex-shrink: 0;"' : '';

    return `
      <div class="sorare-card-box ${card.scarcity}" ${slotStyle}>
        <div class="card-image-wrap" style="position:relative; width:100%; aspect-ratio:0.75; background:#0b1120; overflow:hidden; border-radius:8px 8px 0 0;">
          <span class="card-pos-badge" style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.8);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;">${card.position}</span>
          <span class="card-bonus-badge" style="position:absolute;top:6px;right:6px;background:#10b981;color:#fff;padding:2px 5px;border-radius:4px;font-size:10px;font-weight:bold;">+${card.bonusPct}%</span>
          <img src="${card.pictureUrl || fallback}" alt="${card.name}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${fallback}'" />
          ${capBadge}
        </div>
        <div style="padding: 8px; background:#1e293b; border-radius:0 0 8px 8px;">
          <div style="font-weight:bold; font-size:13px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${card.name}">${card.name}</div>
          <div style="font-size:11px; color:#94a3b8; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.club}</div>
          <div style="display:flex; justify-content:space-between; background:#0f172a; padding:4px 6px; border-radius:4px; font-size:11px;">
            <div style="text-align:center;"><span style="color:#64748b; font-size:9px; display:block;">L5</span><strong style="color:#38bdf8;">${card.l5}</strong></div>
            <div style="text-align:center;"><span style="color:#64748b; font-size:9px; display:block;">L15</span><strong style="color:#38bdf8;">${card.l15}</strong></div>
            <div style="text-align:center;"><span style="color:#64748b; font-size:9px; display:block;">AAS</span><strong style="color:#10b981;">${card.optaAas}</strong></div>
          </div>
        </div>
      </div>
    `;
  },

  renderGallery(cards) {
    const grid = document.getElementById('cards-grid');
    if (!grid) return;

    if (!cards || cards.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 40px;">Nessuna carta trovata con questi filtri.</div>';
      return;
    }

    grid.innerHTML = cards.map(c => this.buildCardHtml(c)).join('');
  },

  filterGallery() {
    const search = (document.getElementById('gallery-search')?.value || '').toLowerCase();
    const pos = document.getElementById('gallery-filter-pos')?.value || 'ALL';
    const scarcity = document.getElementById('gallery-filter-scarcity')?.value || 'ALL';
    const sort = document.getElementById('gallery-sort')?.value || 'l15-desc';

    let list = this.userCards.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search) || c.club.toLowerCase().includes(search);
      const matchPos = pos === 'ALL' || c.position === pos;
      const matchScarcity = scarcity === 'ALL' || c.scarcity === scarcity;
      return matchSearch && matchPos && matchScarcity;
    });

    list.sort((a, b) => {
      if (sort === 'l15-desc') return (b.l15 || 0) - (a.l15 || 0);
      if (sort === 'l5-desc') return (b.l5 || 0) - (a.l5 || 0);
      if (sort === 'bonus-desc') return b.bonusPct - a.bonusPct;
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      return 0;
    });

    this.renderGallery(list);
  },

  generateOptimizedLineups() {
    if (!this.userCards || this.userCards.length < 5) {
      this.notify('❌ Servono almeno 5 carte per calcolare una formazione.', true);
      return;
    }

    const targetLineups = parseInt(document.getElementById('target-lineups')?.value || '3', 10);
    const tournament = document.getElementById('tournament-select')?.value || 'ALL_STAR';

    const usedIds = new Set();
    const lineups = [];

    for (let i = 0; i < targetLineups; i++) {
      const available = this.userCards.filter(c => !usedIds.has(c.id));
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

      // Capitano al punteggio potenziale più alto
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

    this.renderLineups(lineups);
  },

  renderLineups(lineups) {
    const container = document.getElementById('lineups-results-container');
    if (!container) return;

    if (lineups.length === 0) {
      container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px;">Carte insufficienti per creare formazioni complete con questi criteri.</div>';
      return;
    }

    container.innerHTML = lineups.map(l => `
      <div style="background:#111827; border:1px solid #1f2937; border-radius:12px; padding:16px; margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="color:#fff; font-size:16px; margin:0;">Formazione #${l.rank} - ${l.tournament}</h3>
            <span style="color:#94a3b8; font-size:12px;">5 carte uniche senza sovrapposizioni</span>
          </div>
          <div style="background:rgba(59,130,246,0.15); color:#60a5fa; padding:6px 12px; border-radius:8px; font-weight:bold; font-size:14px;">
            Previsto: ${l.projectedScore} pts
          </div>
        </div>
        <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:8px;">
          ${l.cards.map(c => this.buildCardHtml(c, true)).join('')}
        </div>
      </div>
    `).join('');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
