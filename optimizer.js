// SorareHub - Predictive Opta Engine, Global Portfolio Solver & Tactical Matchup Analyzer
const OptimizerEngine = {
  CAPTAIN_MULTIPLIER: 1.50, // Capitano sempre +50%

  buildCascadePortfolio(cards, competition, scarcity, strategy = 'floor') {
    if (!cards || cards.length === 0) return [];

    // 1. Filtra per rarità ed eleggibilità competizione
    let pool = cards
      .filter(c => c.scarcity === scarcity.toLowerCase())
      .filter(card => this.isEligibleForCompetition(card, competition));

    if (pool.length === 0) return [];

    // 2. Calcola proiezione EV multi-fattore e spiegazione tattica individuale
    pool = pool.map(card => {
      const evalResult = this.evaluatePlayer(card, strategy);
      return {
        ...card,
        projectedScore: evalResult.projectedScore,
        baseExpectedScore: evalResult.projectedScore,
        matchupInsight: evalResult.insight,
        matchupScoreDelta: evalResult.matchupDelta
      };
    });

    // Ordina per tier di disponibilità (Titolari -> Rotazione -> Ultima Spiaggia) e poi EV
    const tierWeight = { starter: 3, rotation: 2, last_resort: 1 };
    pool.sort((a, b) => {
      const tDiff = (tierWeight[b.availabilityTier] || 0) - (tierWeight[a.availabilityTier] || 0);
      if (tDiff !== 0) return tDiff;
      return b.projectedScore - a.projectedScore;
    });

    const lineups = [];
    const usedIds = new Set();
    const rankLabels = [
      'Team A (Top Tier)',
      'Team B (Secondary)',
      'Team C (Contender)',
      'Team D (Backup)',
      'Team E (Longshot)'
    ];

    let teamIdx = 0;
    while (true) {
      const available = pool.filter(c => !usedIds.has(c.id));
      const lineup = this.solveOptimalLineup(available, competition, strategy);
      if (!lineup) break;

      // Clona i giocatori selezionati e assegna il Capitano (+50%) al miglior candidato
      const starters = lineup.starters.map(p => ({ ...p, isCaptain: false }));
      starters.sort((a, b) => b.projectedScore - a.projectedScore);

      starters[0].isCaptain = true;
      starters[0].projectedScore = Math.round(starters[0].projectedScore * this.CAPTAIN_MULTIPLIER);

      starters.forEach(p => usedIds.add(p.id));

      const totalProjected = starters.reduce((acc, p) => acc + p.projectedScore, 0);
      const inSeasonCount = starters.filter(p => p.isInSeason).length;
      const lastResortCount = starters.filter(p => p.isLastResort).length;

      lineups.push({
        rankLabel: rankLabels[teamIdx] || `Team ${String.fromCharCode(65 + teamIdx)}`,
        format: competition.format,
        starters: starters,
        totalProjected: totalProjected,
        inSeasonCount: inSeasonCount,
        lastResortCount: lastResortCount
      });

      teamIdx++;
    }

    return lineups;
  },

  evaluatePlayer(card, strategy) {
    // Caso Ultima Spiaggia: infortunato, squalificato, senza partita o L5 = 0
    if (card.isLastResort) {
      const fallbackBase = card.l15 > 0 ? Math.max(2, Math.round(card.l15 * 0.06)) : 2;
      return {
        projectedScore: fallbackBase,
        matchupDelta: 0,
        insight: this.buildTacticalInsight(card, strategy, 0, fallbackBase)
      };
    }

    const l15 = card.l15 || card.l5 || 40;
    const l5 = card.l5 || l15;
    const aas = card.avgAas > 0 ? card.avgAas : l15 * 0.55;
    const dec = card.avgDecisive > 0 ? card.avgDecisive : Math.max(0, l5 - aas);
    const peak = card.maxRecentScore > 0 ? card.maxRecentScore : l5;

    // 1. Base statistica differenziata per strategia
    let rawEv = 0;
    if (strategy === 'ceiling') {
      // Max Ceiling: premia forma recente L5, picco massimo ed esplosività Decisive
      rawEv = (l5 * 0.42) + (peak * 0.28) + ((aas + dec * 1.15) * 0.30);
      if (card.stdDev >= 14) rawEv += 2.5; // Premia profili ad alta varianza/upside
    } else {
      // Max Floor: premia solidità L15, volume puro Opta AAS e costanza
      rawEv = (l15 * 0.50) + (l5 * 0.25) + ((aas * 1.35) * 0.25);
      if (card.stdDev > 0 && card.stdDev <= 10) rawEv += 2.0; // Premia regolarità
    }

    // 2. Fattore minutaggio e probabilità titolarità reale
    let minutesFactor = 1.0;
    if (card.availabilityTier === 'starter') {
      minutesFactor = card.avgMins >= 80 ? 1.03 : 0.98;
    } else if (card.availabilityTier === 'rotation') {
      const ratio = Math.min(0.85, Math.max(0.45, (card.avgMins || 40) / 85));
      minutesFactor = ratio;
    }

    // 3. Modificatori Tattici & Matchup della partita
    let matchupMod = 1.0;

    // Fattore Casa / Trasferta
    if (card.isHome === true) {
      matchupMod += (card.position === 'GK' || card.position === 'DEF') ? 0.06 : 0.04;
    } else if (card.isHome === false) {
      matchupMod -= 0.02;
    }

    // Specialità Opta reali
    const traits = card.tacticalTraits || {};
    if (traits.setPiece) {
      matchupMod += strategy === 'floor' ? 0.05 : 0.04;
    }
    if (traits.aerial && (card.position === 'DEF' || card.position === 'FWD')) {
      matchupMod += 0.035;
    }
    if (traits.ballWinner && (card.position === 'DEF' || card.position === 'MID')) {
      matchupMod += strategy === 'floor' ? 0.04 : 0.02;
    }
    if (traits.clinical && strategy === 'ceiling') {
      matchupMod += 0.05;
    }
    if ((card.position === 'GK' || card.position === 'DEF') && traits.cleanSheets >= 2 && card.isHome) {
      matchupMod += 0.04;
    }

    // 4. Moltiplicatore carta reale (XP + In-Season + Collection)
    const cardMultiplier = card.powerMultiplier || 1.0;
    const finalProjected = Math.max(5, Math.round(rawEv * minutesFactor * matchupMod * cardMultiplier));
    const matchupDeltaPct = Math.round((matchupMod - 1) * 100);

    return {
      projectedScore: finalProjected,
      matchupDelta: matchupDeltaPct,
      insight: this.buildTacticalInsight(card, strategy, matchupDeltaPct, finalProjected)
    };
  },

  buildTacticalInsight(card, strategy, matchupDeltaPct, projectedScore) {
    if (card.isLastResort) {
      return `⚠️ ULTIMA SPIAGGIA • ${card.unavailableReason}. Inserito solo per completare la formazione per assenza di altri titolari disponibili nel ruolo (L15 storico: ${card.l15 || 0}).`;
    }

    const venueTag = card.isHome === true
      ? `🏠 Casa vs ${card.opponentName}`
      : (card.isHome === false ? `✈️ Trasferta vs ${card.opponentName}` : `⚽ vs ${card.opponentName}`);

    const minutesTag = card.availabilityTier === 'starter'
      ? `Titolare (${card.starterCount}/5 gare da 60'+, media ${card.avgMins}')`
      : `Rotazione/Subentrante (${card.playedCount}/5 presenze, media ${card.avgMins}')`;

    const trendDiff = Number((card.l5 - card.l15).toFixed(1));
    const trendStr = trendDiff >= 3
      ? `forma in netta crescita (L5 ${card.l5} vs L15 ${card.l15})`
      : (trendDiff <= -3
        ? `leggero calo recente (L5 ${card.l5} vs L15 ${card.l15})`
        : `rendimento stabile (L5 ${card.l5} • L15 ${card.l15})`);

    const traits = card.tacticalTraits || {};
    const tacticalNotes = [];

    if (card.position === 'GK') {
      if (card.isHome) tacticalNotes.push('fattore campo favorevole per Clean Sheet');
      if (traits.cleanSheets >= 2) tacticalNotes.push(`${traits.cleanSheets} reti inviolate nelle ultime 5`);
      if (card.avgAas > 0) tacticalNotes.push(`volume parate/uscite AAS: ${card.avgAas} pt`);
    } else if (card.position === 'DEF') {
      if (traits.aerial) tacticalNotes.push('dominanza aerea sui piazzati offensivi/difensivi');
      if (traits.ballWinner) tacticalNotes.push('alto volume di contrasti e intercetti Opta');
      if (traits.setPiece) tacticalNotes.push('batte punizioni/corner con alto potenziale assist');
      if (card.isHome) tacticalNotes.push('vantaggio casalingo in ottica Clean Sheet');
    } else if (card.position === 'MID') {
      if (traits.setPiece) tacticalNotes.push('tiratore di piazzati e passaggi chiave (floor alto)');
      if (traits.ballWinner) tacticalNotes.push('recuperi palla costanti in mediana');
      if (traits.clinical) tacticalNotes.push(`incisivo in zona gol (${traits.goals}G/${traits.assists}A recenti)`);
      if (card.avgAas > 0) tacticalNotes.push(`AAS medio: ${card.avgAas} pt`);
    } else {
      // FWD
      if (traits.clinical) tacticalNotes.push(`finalizzatore caldo (${traits.goals}G/${traits.assists}A nelle ultime 5)`);
      if (traits.aerial) tacticalNotes.push('pericoloso nel gioco aereo in area avversaria');
      if (traits.setPiece) tacticalNotes.push('coinvolto nei piazzati e rifiniture');
      if (card.maxRecentScore >= 75) tacticalNotes.push(`picco recente fino a ${card.maxRecentScore} pt`);
    }

    if (tacticalNotes.length === 0) {
      tacticalNotes.push(strategy === 'ceiling'
        ? `upside su azioni decisive (DS medio: ${card.avgDecisive} pt)`
        : `base Opta regolare (AAS medio: ${card.avgAas} pt)`);
    }

    const deltaSign = matchupDeltaPct >= 0 ? `+${matchupDeltaPct}%` : `${matchupDeltaPct}%`;
    return `${venueTag} • ${minutesTag}. ${trendStr.charAt(0).toUpperCase() + trendStr.slice(1)}. Punti di forza: ${tacticalNotes.join(', ')} (indice matchup ${deltaSign}, bonus carta +${card.bonusPct}%).`;
  },

  // Solver combinatorio globale: valuta le migliori combinazioni complessive (non greedy)
  solveOptimalLineup(pool, competition, strategy) {
    if (competition.format === 'SO7') {
      return this.solveOptimalSO7(pool, strategy);
    }
    return this.solveOptimalSO5(pool, competition.inSeasonRequired || 0, strategy);
  },

  solveOptimalSO5(pool, minInSeason, strategy) {
    // Prende i top candidati per ruolo per esplorare combinazioni ottimali in tempi istantanei
    const gks = pool.filter(c => c.position === 'GK').slice(0, 6);
    const defs = pool.filter(c => c.position === 'DEF').slice(0, 10);
    const mids = pool.filter(c => c.position === 'MID').slice(0, 10);
    const fwds = pool.filter(c => c.position === 'FWD').slice(0, 10);
    const extras = pool.filter(c => c.position !== 'GK').slice(0, 14);

    if (!gks.length || !defs.length || !mids.length || !fwds.length || extras.length < 4) {
      return null;
    }

    let bestTeam = null;
    let bestScore = -1;

    for (const gk of gks) {
      for (const def of defs) {
        if (def.id === gk.id) continue;
        for (const mid of mids) {
          if (mid.id === gk.id || mid.id === def.id) continue;
          for (const fwd of fwds) {
            if (fwd.id === gk.id || fwd.id === def.id || fwd.id === mid.id) continue;

            for (const extra of extras) {
              if (
                extra.id === gk.id ||
                extra.id === def.id ||
                extra.id === mid.id ||
                extra.id === fwd.id
              ) continue;

              const team = [
                { ...gk, slotRole: 'GK' },
                { ...def, slotRole: 'DEF' },
                { ...mid, slotRole: 'MID' },
                { ...fwd, slotRole: 'FWD' },
                { ...extra, slotRole: 'EXTRA' }
              ];

              const inSeasonCount = team.filter(p => p.isInSeason).length;
              if (inSeasonCount < minInSeason) continue;

              const teamValue = this.scoreTeamCombination(team, strategy);
              if (teamValue > bestScore) {
                bestScore = teamValue;
                bestTeam = team;
              }
            }
          }
        }
      }
    }

    return bestTeam ? { starters: bestTeam } : null;
  },

  solveOptimalSO7(pool, strategy) {
    const gks = pool.filter(c => c.position === 'GK').slice(0, 5);
    const defs = pool.filter(c => c.position === 'DEF').slice(0, 8);
    const mids = pool.filter(c => c.position === 'MID').slice(0, 8);
    const fwds = pool.filter(c => c.position === 'FWD').slice(0, 6);
    const extras = pool.filter(c => c.position !== 'GK').slice(0, 10);

    if (gks.length < 1 || defs.length < 2 || mids.length < 2 || fwds.length < 1) return null;

    let bestTeam = null;
    let bestScore = -1;

    for (const gk of gks) {
      for (let i = 0; i < defs.length; i++) {
        for (let j = i + 1; j < defs.length; j++) {
          const d1 = defs[i];
          const d2 = defs[j];
          for (let m = 0; m < mids.length; m++) {
            for (let n = m + 1; n < mids.length; n++) {
              const m1 = mids[m];
              const m2 = mids[n];
              for (const fwd of fwds) {
                const used = new Set([gk.id, d1.id, d2.id, m1.id, m2.id, fwd.id]);
                const extra = extras.find(e => !used.has(e.id));
                if (!extra) continue;

                const team = [
                  { ...gk, slotRole: 'GK' },
                  { ...d1, slotRole: 'DEF' },
                  { ...d2, slotRole: 'DEF' },
                  { ...m1, slotRole: 'MID' },
                  { ...m2, slotRole: 'MID' },
                  { ...fwd, slotRole: 'FWD' },
                  { ...extra, slotRole: 'EXTRA' }
                ];

                const teamValue = this.scoreTeamCombination(team, strategy);
                if (teamValue > bestScore) {
                  bestScore = teamValue;
                  bestTeam = team;
                }
              }
            }
          }
        }
      }
    }

    return bestTeam ? { starters: bestTeam } : null;
  },

  // Valuta la combinazione tenendo conto del Capitano +50%, stacking e anti-conflitto
  scoreTeamCombination(team, strategy) {
    let sum = 0;
    let maxIndividual = 0;
    let lastResortPenalty = 0;

    for (const p of team) {
      sum += p.projectedScore;
      if (p.projectedScore > maxIndividual) maxIndividual = p.projectedScore;
      // Forte penalità ai giocatori "ultima spiaggia" così vengono scelti SOLO se non c'è alternativa
      if (p.isLastResort) lastResortPenalty += 500;
    }

    // Bonus Capitano +50% sul migliore della formazione
    let total = sum + (maxIndividual * (this.CAPTAIN_MULTIPLIER - 1));

    // Bonus Stacking & Anti-conflitto nella stessa Gameweek
    const gk = team.find(p => p.slotRole === 'GK');
    const defenders = team.filter(p => p.position === 'DEF');
    const attackers = team.filter(p => p.position === 'FWD' || p.position === 'MID');

    // Stack positivo GK + DEF stesso club (Clean Sheet correlato)
    if (gk && gk.clubSlug !== 'no-club') {
      const sameClubDef = defenders.some(d => d.clubSlug === gk.clubSlug);
      if (sameClubDef && gk.isHome) {
        total += strategy === 'ceiling' ? 4.5 : 2.5;
      }

      // Anti-conflitto: evita di schierare un attaccante contro il tuo stesso portiere
      const facingOwnGk = attackers.some(a => a.opponentSlug && a.opponentSlug === gk.clubSlug);
      if (facingOwnGk) {
        total -= 4.0;
      }
    }

    return total - lastResortPenalty;
  },

  isEligibleForCompetition(card, comp) {
    if (comp.u23Only && !card.isU23) return false;
    if (comp.isUefaChampions) return card.isUefaChampions === true;
    if (comp.isUefaContender) return card.isUefaContender === true;
    if (comp.leagues.includes('ALL')) return true;
    return comp.leagues.includes(card.leagueSlug);
  }
};

window.OptimizerEngine = OptimizerEngine;
