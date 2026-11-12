// SorareHub - Fast Deterministic Opta Engine & Tactical Matchup Analyzer
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
    while (teamIdx < 12) {
      const available = pool.filter(c => !usedCardIds.has(c.id));
      const lineup = this.solveFastLineup(available, competition, strategy);
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

  getPlayerKey(card) {
    return String(card.playerSlug || card.name || card.id).toLowerCase().trim();
  },

  // Costruzione rapida O(N) senza cicli nidificati pesanti: zero blocchi UI
  solveFastLineup(pool, competition, strategy) {
    if (competition.format === 'SO7') {
      return this.solveFastSO7(pool, strategy);
    }
    return this.solveFastSO5(pool, competition.inSeasonRequired || 0);
  },

  solveFastSO5(pool, minInSeason) {
    const pickBestTeam = (sourcePool) => {
      const usedSlugs = new Set();
      const pick = (pos) => {
        const found = sourcePool.find(c => c.position === pos && !usedSlugs.has(this.getPlayerKey(c)));
        if (found) usedSlugs.add(this.getPlayerKey(found));
        return found;
      };

      const gk = pick('GK');
      const def = pick('DEF');
      const mid = pick('MID');
      const fwd = pick('FWD');
      if (!gk || !def || !mid || !fwd) return null;

      const extra = sourcePool.find(c => c.position !== 'GK' && !usedSlugs.has(this.getPlayerKey(c)));
      if (!extra) return null;

      return [
        { ...gk, slotRole: 'GK' },
        { ...def, slotRole: 'DEF' },
        { ...mid, slotRole: 'MID' },
        { ...fwd, slotRole: 'FWD' },
        { ...extra, slotRole: 'EXTRA' }
      ];
    };

    // Tentativo 1: prende i migliori assoluti rispettando playerSlug univoci
    let team = pickBestTeam(pool);
    if (!team) return null;

    if (team.filter(p => p.isInSeason).length >= minInSeason) {
      return { starters: team };
    }

    // Tentativo 2: se mancano In-Season, dà priorità alle carte In-Season mantenendo i Classic solo dove mancano In-Season
    const inSeasonFirstPool = [
      ...pool.filter(c => c.isInSeason),
      ...pool.filter(c => !c.isInSeason)
    ];
    team = pickBestTeam(inSeasonFirstPool);
    if (team && team.filter(p => p.isInSeason).length >= minInSeason) {
      return { starters: team };
    }

    return null;
  },

  solveFastSO7(pool, strategy) {
    const usedSlugs = new Set();
    const pick = (pos) => {
      const found = pool.find(c => c.position === pos && !usedSlugs.has(this.getPlayerKey(c)));
      if (found) usedSlugs.add(this.getPlayerKey(found));
      return found;
    };

    const gk = pick('GK');
    const d1 = pick('DEF');
    const d2 = pick('DEF');
    const m1 = pick('MID');
    const m2 = pick('MID');
    const fwd = pick('FWD');

    if (!gk || !d1 || !d2 || !m1 || !m2 || !fwd) return null;

    // Cerca il miglior EXTRA evitando duplicati playerSlug e conflitti contro il proprio GK
    const extraCandidates = pool.filter(c => c.position !== 'GK' && !usedSlugs.has(this.getPlayerKey(c)));
    if (extraCandidates.length === 0) return null;

    let bestExtra = extraCandidates[0];
    if (gk.clubSlug !== 'no-club') {
      const safeExtra = extraCandidates.find(e => e.opponentSlug !== gk.clubSlug);
      if (safeExtra) bestExtra = safeExtra;
    }

    return {
      starters: [
        { ...gk, slotRole: 'GK' },
        { ...d1, slotRole: 'DEF' },
        { ...d2, slotRole: 'DEF' },
        { ...m1, slotRole: 'MID' },
        { ...m2, slotRole: 'MID' },
        { ...fwd, slotRole: 'FWD' },
        { ...bestExtra, slotRole: 'EXTRA' }
      ]
    };
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
