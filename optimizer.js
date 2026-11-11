// SorareHub - Advanced Solver Engine (Zero-Bench, Multi-Lineup Cascade)
const OptimizerEngine = {
  buildCascadePortfolio(cards, competition, scarcity, strategy = 'floor') {
    if (!cards || cards.length === 0) return [];

    // Filtra per rarità scelta
    let pool = cards.filter(c => c.scarcity === scarcity.toLowerCase());

    // Filtra secondo le regole della competizione selezionata
    pool = pool.filter(card => this.isEligibleForCompetition(card, competition));

    // Valutazione Opta xG/xA e AAS con proiezione punteggio
    pool = pool.map(card => {
      const score = this.calculatePlayerProjection(card, strategy);
      return { ...card, projectedScore: score };
    });

    // Ordina decrescente per punteggio proiettato
    pool.sort((a, b) => b.projectedScore - a.projectedScore);

    const lineups = [];
    const usedIds = new Set();
    const rankLabels = ['Team A (Top Tier)', 'Team B (Secondary)', 'Team C (Contender)', 'Team D (Backup)', 'Team E (Longshot)'];

    let teamIdx = 0;
    while (true) {
      const available = pool.filter(c => !usedIds.has(c.id));
      const lineup = this.solveSingleLineup(available, competition);
      if (!lineup) break;

      // Assegna il capitano (+50% bonus punteggio) al giocatore migliore
      lineup.starters.sort((a, b) => b.projectedScore - a.projectedScore);
      lineup.starters[0].isCaptain = true;
      lineup.starters[0].projectedScore = Math.round(lineup.starters[0].projectedScore * CONFIG.RULES.CAPTAIN_BONUS_MULTIPLIER);

      lineup.starters.forEach(p => usedIds.add(p.id));

      const totalProjected = lineup.starters.reduce((acc, p) => acc + p.projectedScore, 0);
      const inSeasonCount = lineup.starters.filter(p => p.isInSeason).length;

      lineups.push({
        rankLabel: rankLabels[teamIdx] || `Team ${String.fromCharCode(65 + teamIdx)}`,
        format: competition.format,
        starters: lineup.starters,
        totalProjected: totalProjected,
        inSeasonCount: inSeasonCount
      });

      teamIdx++;
    }

    return lineups;
  },

  solveSingleLineup(availablePool, competition) {
    if (competition.format === 'SO7') {
      return this.solveSO7(availablePool);
    }
    return this.solveSO5(availablePool, competition.inSeasonRequired);
  },

  solveSO5(pool, minInSeason) {
    const gks = pool.filter(c => c.position === 'GK');
    const defs = pool.filter(c => c.position === 'DEF');
    const mids = pool.filter(c => c.position === 'MID');
    const fwds = pool.filter(c => c.position === 'FWD');

    if (!gks.length || !defs.length || !mids.length || !fwds.length) return null;

    for (const gk of gks) {
      for (const def of defs) {
        if (def.id === gk.id) continue;
        for (const mid of mids) {
          if (mid.id === gk.id || mid.id === def.id) continue;
          for (const fwd of fwds) {
            if (fwd.id === gk.id || fwd.id === def.id || fwd.id === mid.id) continue;

            const baseStarters = [
              { ...gk, slotRole: 'GK' },
              { ...def, slotRole: 'DEF' },
              { ...mid, slotRole: 'MID' },
              { ...fwd, slotRole: 'FWD' }
            ];

            const baseIds = new Set(baseStarters.map(p => p.id));
            const extraCandidates = pool.filter(c => !baseIds.has(c.id) && c.position !== 'GK');

            for (const extra of extraCandidates) {
              const fullTeam = [...baseStarters, { ...extra, slotRole: 'EXTRA' }];
              const inSeasonCount = fullTeam.filter(p => p.isInSeason).length;

              if (inSeasonCount >= minInSeason) {
                return { starters: fullTeam };
              }
            }
          }
        }
      }
    }
    return null;
  },

  solveSO7(pool) {
    const gks = pool.filter(c => c.position === 'GK');
    const defs = pool.filter(c => c.position === 'DEF');
    const mids = pool.filter(c => c.position === 'MID');
    const fwds = pool.filter(c => c.position === 'FWD');

    if (gks.length < 1 || defs.length < 2 || mids.length < 2 || fwds.length < 1) return null;

    const gk = gks[0];
    const d1 = defs[0];
    const d2 = defs[1];
    const m1 = mids[0];
    const m2 = mids[1];
    const f1 = fwds[0];

    const baseTeam = [
      { ...gk, slotRole: 'GK' },
      { ...d1, slotRole: 'DEF' },
      { ...d2, slotRole: 'DEF' },
      { ...m1, slotRole: 'MID' },
      { ...m2, slotRole: 'MID' },
      { ...f1, slotRole: 'FWD' }
    ];

    const baseIds = new Set(baseTeam.map(p => p.id));
    const extraCandidates = pool.filter(c => !baseIds.has(c.id) && c.position !== 'GK');

    if (!extraCandidates.length) return null;

    const extra = extraCandidates[0];
    return {
      starters: [...baseTeam, { ...extra, slotRole: 'EXTRA' }]
    };
  },

  isEligibleForCompetition(card, comp) {
    if (comp.u23Only && !card.isU23) return false;

    // UEFA Competitions
    if (comp.isUefaChampions) return card.isUefaChampions === true;
    if (comp.isUefaContender) return card.isUefaContender === true;

    // All-Star accetta qualsiasi lega
    if (comp.leagues.includes('ALL')) return true;

    // Mono-lega o tornei specifici
    return comp.leagues.includes(card.leagueSlug);
  },

  calculatePlayerProjection(card, strategy) {
    const weights = CONFIG.WEIGHTS[strategy === 'ceiling' ? 'CEILING_MODE' : 'FLOOR_MODE'];
    
    // Punteggio base Opta ponderato
    const aasComponent = (card.optaAas || 45) * weights.aas;
    const decisiveComponent = ((card.xgXa || 0.2) * 50 + (card.position === 'GK' ? 30 : 20)) * weights.decisive;
    const baseScore = aasComponent + decisiveComponent;

    // Moltiplicatore potenza (In-Season + Collezione + Livello XP)
    const multiplier = card.powerMultiplier || 1.05;
    return Math.round(baseScore * multiplier);
  }
};

window.OptimizerEngine = OptimizerEngine;
