// SorareHub - Multi-Lineup Cascade Portfolio Solver (Senza Riserve)
const OptimizerEngine = {
  scoreCard(card, strategy) {
    const weights = strategy === 'ceiling' ? CONFIG.WEIGHTS.CEILING_MODE : CONFIG.WEIGHTS.FLOOR_MODE;

    const aasComponent = card.optaAas * weights.aas;
    const matchupFactor = card.position === 'GK' || card.position === 'DEF'
      ? Math.max(0.75, 1.8 - card.oppXga)
      : Math.max(0.8, card.oppXga);

    const decisiveRaw = (card.xgXa * 48) * matchupFactor;
    const setPieceBoost = card.setPieceTaker ? 4.5 : 0;
    const aerialBoost = card.aerialThreat ? 2.5 : 0;
    const decisiveComponent = (decisiveRaw + setPieceBoost + aerialBoost) * weights.decisive;

    const projectedScore = (aasComponent + decisiveComponent) * card.powerMultiplier;

    const badges = [];
    if (card.confirmedXi) badges.push('🟢 Confirmed XI');
    if (card.optaAas >= 52) badges.push('📊 High AAS Opta');
    if (card.setPieceTaker) badges.push('🎯 Piazzati');
    if (card.aerialThreat) badges.push('✈️ Gioco Aereo');
    if (card.xgXa >= 0.40) badges.push('🔥 Elevato xG+xA');
    if (card.position === 'GK') badges.push('🧤 Safe Clean Sheet');

    return {
      ...card,
      projectedScore: parseFloat(projectedScore.toFixed(1)),
      badges
    };
  },

  buildCascadePortfolio(allCards, competition, scarcity, strategy) {
    const eligibleCards = allCards
      .filter(c => c.scarcity === scarcity)
      .filter(c => {
        if (competition.u23Only && !c.isU23) return false;
        if (competition.leagues.includes('ALL')) return true;
        return competition.leagues.includes(c.leagueSlug);
      })
      .map(c => this.scoreCard(c, strategy))
      .sort((a, b) => b.projectedScore - a.projectedScore);

    const usedCardIds = new Set();
    const generatedLineups = [];
    const teamLabels = ['TEAM A (PRIMARIA)', 'TEAM B (SECONDARIA)', 'TEAM C (TERZIARIA)', 'TEAM D (DEPTH)', 'TEAM E (EXTRA)'];

    for (let t = 0; t < teamLabels.length; t++) {
      const lineup = this.solveSingleLineup(eligibleCards, usedCardIds, competition);
      if (!lineup) break;
      generatedLineups.push({
        rankLabel: teamLabels[t],
        ...lineup
      });
    }

    return generatedLineups;
  },

  solveSingleLineup(pool, usedCardIds, competition) {
    const isSO7 = competition.format === 'SO7';
    const requiredPositions = isSO7
      ? ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'EXTRA']
      : ['GK', 'DEF', 'MID', 'FWD', 'EXTRA'];

    const minInSeason = competition.inSeasonRequired || 0;
    const selected = [];
    const usedPlayersInThisLineup = new Set();

    const pickBestForSlot = (posFilter, mustBeInSeason) => {
      return pool.find(c => {
        if (usedCardIds.has(c.id)) return false;
        if (usedPlayersInThisLineup.has(c.playerSlug)) return false;
        if (mustBeInSeason && !c.isInSeason) return false;
        if (posFilter === 'EXTRA') return c.position !== 'GK';
        return c.position === posFilter;
      });
    };

    let classicSlotsAllowed = requiredPositions.length - minInSeason;

    for (const slotPos of requiredPositions) {
      const candidate = pickBestForSlot(slotPos, classicSlotsAllowed <= 0);
      if (!candidate) return null;

      if (!candidate.isInSeason) {
        classicSlotsAllowed--;
      }

      selected.push({ ...candidate, slotRole: slotPos });
      usedCardIds.add(candidate.id);
      usedPlayersInThisLineup.add(candidate.playerSlug);
    }

    // Bonus Stacking Clean Sheet (Portiere + Difensore stesso club)
    const gk = selected.find(p => p.slotRole === 'GK');
    selected.forEach(p => {
      if (p.slotRole !== 'GK' && p.position === 'DEF' && gk && p.clubSlug === gk.clubSlug) {
        p.projectedScore = parseFloat((p.projectedScore + CONFIG.RULES.STACK_CORRELATION_BONUS).toFixed(1));
        p.badges.unshift('🔗 Stack Difesa');
      }
    });

    // Capitano al punteggio EV più alto
    let captainIdx = 0;
    selected.forEach((p, idx) => {
      if (p.projectedScore > selected[captainIdx].projectedScore) captainIdx = idx;
    });
    selected[captainIdx].isCaptain = true;
    selected[captainIdx].projectedScore = parseFloat((selected[captainIdx].projectedScore * 1.20).toFixed(1));

    const totalProjected = selected.reduce((sum, p) => sum + p.projectedScore, 0).toFixed(1);
    const inSeasonCount = selected.filter(p => p.isInSeason).length;

    return {
      starters: selected,
      bench: [], // Riserve azzerate
      totalProjected,
      inSeasonCount,
      format: competition.format
    };
  }
};

window.OptimizerEngine = OptimizerEngine;
