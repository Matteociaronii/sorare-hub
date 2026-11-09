// SorareHub - Official Configuration & Rules Engine
const CONFIG = {
  CLIENT_ID: 'nb6KHL2pLACJu0KArFiJlejgfPzCQLm7hVT7_HghcGo',
  REDIRECT_URI: 'https://matteociaronii.github.io/sorare-hub/',
  AUTH_ENDPOINT: 'https://sorare.com/oauth/authorize',
  TOKEN_ENDPOINT: 'https://api.sorare.com/oauth/token',
  GRAPHQL_ENDPOINT: 'https://api.sorare.com/graphql',
  CORS_PROXY: 'https://corsproxy.io/?',
  SCOPES: 'read',

  // Regole Ufficiali Sorare 2026/2027
  RULES: {
    MIN_IN_SEASON_SO5: 4,       // Minimo 4 carte su 5 In-Season nei tornei In-Season
    MIN_IN_SEASON_SO7: 5,       // Minimo 5 carte su 7 In-Season se applicabile
    SUB_FLOOR_SCORE: 35.0,      // Base Floor garantita a 35 pt per i subentranti
    GK_3RD_GOAL_PENALTY: 0,     // Nessun malus aggiuntivo al 3° gol subito dal portiere
    IN_SEASON_BONUS: 0.05,      // +5% bonus nativo carte della stagione corrente
    STACK_CORRELATION_BONUS: 3.2 // Bonus sinergia Clean Sheet (GK + DEF stesso club)
  },

  // Pesi Decoupled Engine (Opta + Wyscout/StatsBomb)
  WEIGHTS: {
    FLOOR_MODE: { aas: 0.72, decisive: 0.28, minutesSecurity: 1.25 },
    CEILING_MODE: { aas: 0.42, decisive: 0.58, minutesSecurity: 1.05 }
  },

  // Struttura Ufficiale Competizioni Sorare (Fallback & Filtro Leghe Certificato)
  OFFICIAL_COMPETITIONS: [
    {
      id: 'champion_in_season',
      name: 'Champion — In-Season (SO5)',
      region: 'CHAMPION',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['premier-league-gb-eng', 'laliga-es', 'serie-a-it', 'bundesliga-de', 'ligue-1-fr']
    },
    {
      id: 'champion_classic',
      name: 'Champion — Classic (SO5)',
      region: 'CHAMPION',
      format: 'SO5',
      inSeasonRequired: 0,
      leagues: ['premier-league-gb-eng', 'laliga-es', 'serie-a-it', 'bundesliga-de', 'ligue-1-fr']
    },
    {
      id: 'challenger_in_season',
      name: 'Challenger — In-Season (SO5)',
      region: 'CHALLENGER',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['eredivisie-nl', 'primeira-liga-pt', 'jupiler-pro-league-be', 'premiership-gb-sct', 'super-lig-tr', 'championship-gb-eng']
    },
    {
      id: 'challenger_classic',
      name: 'Challenger — Classic (SO5)',
      region: 'CHALLENGER',
      format: 'SO5',
      inSeasonRequired: 0,
      leagues: ['eredivisie-nl', 'primeira-liga-pt', 'jupiler-pro-league-be', 'premiership-gb-sct', 'super-lig-tr', 'championship-gb-eng']
    },
    {
      id: 'contender_in_season',
      name: 'Contender — In-Season (SO5)',
      region: 'CONTENDER',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['2-bundesliga-de', 'segunda-division-es', 'serie-b-it', 'superliga-dk', 'eliteserien-no', 'bundesliga-at', 'super-league-ch', 'ekstraklasa-pl']
    },
    {
      id: 'contender_classic',
      name: 'Contender — Classic (SO5)',
      region: 'CONTENDER',
      format: 'SO5',
      inSeasonRequired: 0,
      leagues: ['2-bundesliga-de', 'segunda-division-es', 'serie-b-it', 'superliga-dk', 'eliteserien-no', 'bundesliga-at', 'super-league-ch', 'ekstraklasa-pl']
    },
    {
      id: 'u23_in_season',
      name: 'Under 23 — In-Season (SO5)',
      region: 'U23',
      format: 'SO5',
      inSeasonRequired: 4,
      u23Only: true,
      leagues: ['ALL']
    },
    {
      id: 'u23_classic',
      name: 'Under 23 — Classic (SO5)',
      region: 'U23',
      format: 'SO5',
      inSeasonRequired: 0,
      u23Only: true,
      leagues: ['ALL']
    },
    {
      id: 'global_all_star_so7',
      name: 'All-Star — Classic SO7 (7 vs 7)',
      region: 'GLOBAL',
      format: 'SO7',
      inSeasonRequired: 0,
      leagues: ['ALL']
    },
    {
      id: 'americas_in_season',
      name: 'Americas — In-Season (MLS / Liga MX / LatAm)',
      region: 'AMERICAS',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['mlspa-us', 'liga-mx-mx', 'serie-a-br', 'liga-profesional-ar']
    },
    {
      id: 'european_nights',
      name: 'European Nights — UCL / UEL / UECL (SO5)',
      region: 'EUROPE',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['uefa-champions-league', 'uefa-europa-league', 'uefa-europa-conference-league']
    }
  ]
};

window.CONFIG = CONFIG;
