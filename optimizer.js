// SorareHub - Multi-Lineup Cascade Portfolio Solver
const OptimizerEngine = {
  scoreCard(card, strategy) {
    const weights = strategy === 'ceiling' ? CONFIG.WEIGHTS.CEILING_MODE : CONFIG.WEIGHTS.FLOOR_MODE;

    // 1. Componente Volume AAS Opta
    const aasComponent = card.optaAas * weights.aas;

    // 2. Componente Punteggio Decisivo Atteso (Wyscout/StatsBomb xG+xA ponderato su xGA avversario)
    const matchupFactor = card.position === 'GK' || card.position === 'DEF'
      ? Math.max(0.75, 1.8 - card.oppXga) // Difese premiate contro attacchi sterili
      : Math.max(0.8, card.oppXga);       // Attacchi premiati contro difese permeabili

    const decisiveRaw = (card.xgXa * 48) * matchupFactor;
    const setPieceBoost = card.setPieceTaker ? 4.5 : 0;
    const aerialBoost = card.aerialThreat ? 2.5 : 0;
    const decisiveComponent = (decisiveRaw + setPieceBoost + aerialBoost) * weights.decisive;

    // 3. Regola Subentrante Sorare (Floor 35 pt garantito)
    const startProb = card.starterProb / 100;
    const subProb = 1 - startProb;
    const expectedRawScore = (startProb * (aasComponent + decisiveComponent)) +
                             (subProb * CONFIG.RULES.SUB_FLOOR_SCORE);

    // 4. Moltiplicatore nativo Carta (XP + Collezione + In-Season)
    const projectedScore = expectedRawScore * card.powerMultiplier;

    // 5. Generazione Badge Tattici Trasparenti
    const badges = [];
    if (card.confirmedXi) badges.push('🟢 Confirmed XI');
    if (card.optaAas >= 52) badges.push('📊 High Opta AAS');
    if (card.setPieceTaker) badges.push('🎯 Piazzati/Corner');
    if (card.aerialThreat) badges.push('✈️ Minaccia Aerea');
    if (card.xgXa >= 0.45) badges.push('🔥 Elite xG+xA');
    if (card.position === 'GK') badges.push('🧤 Regola 3° Gol Safe');

    return {
      ...card,
      projectedScore: parseFloat(projectedScore.toFixed(1)),
      badges
    };
  },

  buildCascadePortfolio(allCards, competition, scarcity, strategy) {
    // Filtra per rarità e requisiti di lega/età della competizione ufficiale
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
    const teamLabels = ['TEAM A — PRIMARIA', 'TEAM B — SECONDARIA', 'TEAM C — DEPTH', 'TEAM D — EXTRA'];

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

    // Helper per pescare la miglior carta disponibile per uno slot
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
      let candidate = pickBestForSlot(slotPos, classicSlotsAllowed <= 0);
      if (!candidate) return null; // Impossibile completare la formazione

      if (!candidate.isInSeason) {
        classicSlotsAllowed--;
      }

      selected.push({ ...candidate, slotRole: slotPos });
      usedCardIds.add(candidate.id);
      usedPlayersInThisLineup.add(candidate.playerSlug);
    }

    // Calcolo Bonus Stacking Difensivo (GK + DEF stesso club)
    const gk = selected.find(p => p.slotRole === 'GK');
    selected.forEach(p => {
      if (p.slotRole !== 'GK' && p.position === 'DEF' && gk && p.clubSlug === gk.clubSlug) {
        p.projectedScore = parseFloat((p.projectedScore + CONFIG.RULES.STACK_CORRELATION_BONUS).toFixed(1));
        p.badges.unshift('🔗 Clean Sheet Stack');
      }
    });

    // Assegna Capitano (+20% boost Sorare) al giocatore col punteggio più alto
    let captainIdx = 0;
    selected.forEach((p, idx) => {
      if (p.projectedScore > selected[captainIdx].projectedScore) captainIdx = idx;
    });
    selected[captainIdx].isCaptain = true;
    selected[captainIdx].projectedScore = parseFloat((selected[captainIdx].projectedScore * 1.15).toFixed(1));

    // Costruzione Panchina Smart (2 Slot con Base Floor 35 pt)
    const bench = [];
    for (const bPos of ['DEF/MID', 'MID/FWD']) {
      const subCandidate = pool.find(c => !usedCardIds.has(c.id) && !usedPlayersInThisLineup.has(c.playerSlug) && c.position !== 'GK');
      if (subCandidate) {
        bench.push(subCandidate);
        usedCardIds.add(subCandidate.id);
        usedPlayersInThisLineup.add(subCandidate.playerSlug);
      }
    }

    const totalProjected = selected.reduce((sum, p) => sum + p.projectedScore, 0).toFixed(1);
    const inSeasonCount = selected.filter(p => p.isInSeason).length;

    return {
      starters: selected,
      bench: bench,
      totalProjected,
      inSeasonCount,
      format: competition.format
    };
  }
};

window.OptimizerEngine = OptimizerEngine;
