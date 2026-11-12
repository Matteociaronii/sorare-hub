// SorareHub - Predictive Opta Engine, Global Portfolio Solver & Tactical Matchup Analyzer
const OptimizerEngine = {
  CAPTAIN_MULTIPLIER: 1.50,

  LEAGUE_ALIASES: {
    'premier-league-gb-eng': ['premier-league-gb-eng', 'premier-league'],
    'laliga-es': ['laliga-es', 'primera-division-es', 'la-liga-es'],
    'bundesliga-de': ['bundesliga-de', '1-bundesliga-de'],
    'ligue-1-fr': ['ligue-1-fr', 'ligue-1'],
    'championship-gb-eng': ['championship-gb-eng', 'efl-championship-gb-eng'],
    'primeira-liga-pt': ['primeira-liga-pt', 'liga-portugal-pt', 'liga-nos-pt'],
    'jupiler-pro-league-be': ['jupiler-pro-league-be', 'first-division-a-be'],
    'eredivisie-nl': ['eredivisie-nl', 'eredivisie'],
    'premiership-gb-sct': ['premiership-gb-sct', 'scottish-premiership-gb-sct'],
    'mls-us': ['mls-us', 'major-league-soccer-us', 'major-league-soccer'],
    'j1-league-jp': ['j1-league-jp', 'j1-league'],
    'k-league-1-kr': ['k-league-1-kr', 'k-league-classic-kr'],
    '2-bundesliga-de': ['2-bundesliga-de'],
    'segunda-division-es': ['segunda-division-es', 'laliga2-es'],
    'serie-b-it': ['serie-b-it', 'serie-b'],
    'superliga-dk': ['superliga-dk', 'superligaen-dk'],
    'eliteserien-no': ['eliteserien-no'],
    'bundesliga-at': ['bundesliga-at', 'tipico-bundesliga-at'],
    'super-league-ch': ['super-league-ch', 'raiffeisen-super-league-ch'],
    'ekstraklasa-pl': ['ekstraklasa-pl']
  },

  buildCascadePortfolio(cards, competition, scarcity, strategy = 'floor') {
    if (!cards || cards.length === 0) return [];

    let pool = cards
      .filter(c => c.scarcity === scarcity.toLowerCase())
      .filter(card => this.isEligibleForCompetition(card, competition));

    if (pool.length === 0) return [];

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

    const tierWeight = { starter: 3, rotation: 2, last_resort: 1 };
    pool.sort((a, b) => {
      const tDiff = (tierWeight[b.availabilityTier] || 0) - (tierWeight[a.availabilityTier] || 0);
      if (tDiff !== 0) return tDiff;
      return b.projectedScore - a.projectedScore;
    });

    const lineups = [];
    const usedCardIds = new Set();
    const rankLabels = [
      'Team A (Top Tier)',
      'Team B (Secondary)',
      'Team C (Contender)',
      'Team D (Backup)',
      'Team E (Longshot)'
    ];

    let teamIdx = 0;
    while (teamIdx < 15) {
      const available = pool.filter(c => !usedCardIds.has(c.id));
      const lineup = this.solveOptimalLineup(available, competition, strategy);
      if (!lineup) break;

      const starters = lineup.starters.map(p => ({ ...p, isCaptain: false }));
      starters.sort((a, b) => b.projectedScore - a.projectedScore);

      starters[0].isCaptain = true;
      starters[0].projectedScore = Math.round(starters[0].projectedScore * this.CAPTAIN_MULTIPLIER);

      starters.forEach(p => usedCardIds.add(p.id));

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

  hasDistinctPlayers(team) {
    const seenCardIds = new Set();
    const seenPlayerSlugs = new Set();

    for (const p of team) {
      if (seenCardIds.has(p.id)) return false;
      const pKey = (p.playerSlug || p.name || p.id).toLowerCase().trim();
      if (seenPlayerSlugs.has(pKey)) return false;
      seenCardIds.add(p.id);
      seenPlayerSlugs.add(pKey);
    }
    return true;
  },

  evaluatePlayer(card, strategy) {
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

    let rawEv = 0;
    if (strategy === 'ceiling') {
      rawEv = (l5 * 0.42) + (peak * 0.28) + ((aas + dec * 1.15) * 0.30);
      if (card.stdDev >= 14) rawEv += 2.5;
    } else {
      rawEv = (l15 * 0.50) + (l5 * 0.25) + ((aas * 1.35) * 0.25);
      if (card.stdDev > 0 && card.stdDev <= 10) rawEv += 2.0;
    }

    let minutesFactor = 1.0;
    if (card.availabilityTier === 'starter') {
      minutesFactor = card.avgMins >= 80 ? 1.03 : 0.98;
    } else if (card.availabilityTier === 'rotation') {
      const ratio = Math.min(0.85, Math.max(0.45, (card.avgMins || 40) / 85));
      minutesFactor = ratio;
    }

    let matchupMod = 1.0;
    if (card.isHome === true) {
      matchupMod += (card.position === 'GK' || card.position === 'DEF') ? 0.06 : 0.04;
    } else if (card.isHome === false) {
      matchupMod -= 0.02;
    }

    const traits = card.tacticalTraits || {};
    if (traits.setPiece) matchupMod += strategy === 'floor' ? 0.05 : 0.04;
    if (traits.aerial && (card.position === 'DEF' || card.position === 'FWD')) matchupMod += 0.035;
    if (traits.ballWinner && (card.position === 'DEF' || card.position === 'MID')) matchupMod += strategy === 'floor' ? 0.04 : 0.02;
    if (traits.clinical && strategy === 'ceiling') matchupMod += 0.05;
    if ((card.position === 'GK' || card.position === 'DEF') && traits.cleanSheets >= 2 && card.isHome) matchupMod += 0.04;

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

  solveOptimalLineup(pool, competition, strategy) {
    if (competition.format === 'SO7') {
      return this.solveOptimalSO7(pool, strategy);
    }
    return this.solveOptimalSO5(pool, competition.inSeasonRequired || 0, strategy);
  },

  solveOptimalSO5(pool, minInSeason, strategy) {
    const gks = pool.filter(c => c.position === 'GK').slice(0, 5);
    const defs = pool.filter(c => c.position === 'DEF').slice(0, 7);
    const mids = pool.filter(c => c.position === 'MID').slice(0, 7);
    const fwds = pool.filter(c => c.position === 'FWD').slice(0, 7);
    const extras = pool.filter(c => c.position !== 'GK').slice(0, 10);

    if (!gks.length || !defs.length || !mids.length || !fwds.length || extras.length < 4) {
      return null;
    }

    let bestTeam = null;
    let bestScore = -1;

    for (const gk of gks) {
      for (const def of defs) {
        if (def.playerSlug === gk.playerSlug) continue;
        for (const mid of mids) {
          if (mid.playerSlug === gk.playerSlug || mid.playerSlug === def.playerSlug) continue;
          for (const fwd of fwds) {
            if (fwd.playerSlug === gk.playerSlug || fwd.playerSlug === def.playerSlug || fwd.playerSlug === mid.playerSlug) continue;

            for (const extra of extras) {
              const team = [
                { ...gk, slotRole: 'GK' },
                { ...def, slotRole: 'DEF' },
                { ...mid, slotRole: 'MID' },
                { ...fwd, slotRole: 'FWD' },
                { ...extra, slotRole: 'EXTRA' }
              ];

              if (!this.hasDistinctPlayers(team)) continue;

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

  // Ottimizzato per essere istantaneo (< 10ms) senza bloccare mai il browser
  solveOptimalSO7(pool, strategy) {
    const gks = pool.filter(c => c.position === 'GK').slice(0, 3);
    const defs = pool.filter(c => c.position === 'DEF').slice(0, 5);
    const mids = pool.filter(c => c.position === 'MID').slice(0, 5);
    const fwds = pool.filter(c => c.position === 'FWD').slice(0, 4);
    const extras = pool.filter(c => c.position !== 'GK').slice(0, 8);

    if (gks.length < 1 || defs.length < 2 || mids.length < 2 || fwds.length < 1) return null;

    let bestTeam = null;
    let bestScore = -1;

    for (const gk of gks) {
      for (let i = 0; i < defs.length; i++) {
        for (let j = i + 1; j < defs.length; j++) {
          const d1 = defs[i];
          const d2 = defs[j];
          if (d1.playerSlug === d2.playerSlug) continue;

          for (let m = 0; m < mids.length; m++) {
            for (let n = m + 1; n < mids.length; n++) {
              const m1 = mids[m];
              const m2 = mids[n];
              if (m1.playerSlug === m2.playerSlug) continue;

              for (const fwd of fwds) {
                const usedSlugs = new Set([
                  gk.playerSlug, d1.playerSlug, d2.playerSlug,
                  m1.playerSlug, m2.playerSlug, fwd.playerSlug
                ]);
                if (usedSlugs.size < 6) continue;

                const extra = extras.find(e => !usedSlugs.has(e.playerSlug));
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

                if (!this.hasDistinctPlayers(team)) continue;

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

  scoreTeamCombination(team, strategy) {
    let sum = 0;
    let maxIndividual = 0;
    let lastResortPenalty = 0;

    for (const p of team) {
      sum += p.projectedScore;
      if (p.projectedScore > maxIndividual) maxIndividual = p.projectedScore;
      if (p.isLastResort) lastResortPenalty += 500;
    }

    let total = sum + (maxIndividual * (this.CAPTAIN_MULTIPLIER - 1));

    const gk = team.find(p => p.slotRole === 'GK');
    const defenders = team.filter(p => p.position === 'DEF');
    const attackers = team.filter(p => p.position === 'FWD' || p.position === 'MID');

    if (gk && gk.clubSlug !== 'no-club') {
      const sameClubDef = defenders.some(d => d.clubSlug === gk.clubSlug);
      if (sameClubDef && gk.isHome) {
        total += strategy === 'ceiling' ? 4.5 : 2.5;
      }

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

    const cardLeague = String(card.leagueSlug || '').toLowerCase();
    return comp.leagues.some(targetSlug => {
      const normalizedTarget = String(targetSlug || '').toLowerCase();
      if (normalizedTarget === cardLeague) return true;
      const aliases = this.LEAGUE_ALIASES[normalizedTarget] || [];
      return aliases.includes(cardLeague);
    });
  }
};

window.OptimizerEngine = OptimizerEngine;
