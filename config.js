// SorareHub - Official Configuration & Rules Engine (2026/2027)
const CONFIG = {
  CLIENT_ID: 'nb6KHL2pLACJu0KArFiJlejgfPzCQLm7hVT7_HghcGo',
  REDIRECT_URI: 'https://matteociaronii.github.io/sorare-hub/',
  AUTH_ENDPOINT: 'https://sorare.com/oauth/authorize',
  TOKEN_ENDPOINT: 'https://sorarehub-oauth.matty-ciaroni.workers.dev',
  GRAPHQL_ENDPOINT: 'https://api.sorare.com/graphql',
  CORS_PROXY: 'https://corsproxy.io/?',
  SCOPES: 'read',

  RULES: {
    MIN_IN_SEASON_SO5: 4,
    IN_SEASON_BONUS: 0.05,
    STACK_CORRELATION_BONUS: 3.5
  },

  WEIGHTS: {
    FLOOR_MODE: { aas: 0.72, decisive: 0.28 },
    CEILING_MODE: { aas: 0.40, decisive: 0.60 }
  },

  OFFICIAL_COMPETITIONS: [
    {
      id: 'champion_in_season',
      name: 'Champion — In-Season (Top 5 Leghe)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['premier-league-gb-eng', 'laliga-es', 'serie-a-it', 'bundesliga-de', 'ligue-1-fr']
    },
    {
      id: 'champion_classic',
      name: 'Champion — Classic (Tutte le Annate)',
      format: 'SO5',
      inSeasonRequired: 0,
      leagues: ['premier-league-gb-eng', 'laliga-es', 'serie-a-it', 'bundesliga-de', 'ligue-1-fr']
    },
    {
      id: 'challenger_in_season',
      name: 'Challenger — In-Season (Eredivisie, Liga Portugal, Belgio, Turchia)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['eredivisie-nl', 'primeira-liga-pt', 'jupiler-pro-league-be', 'premiership-gb-sct', 'super-lig-tr', 'championship-gb-eng']
    },
    {
      id: 'challenger_classic',
      name: 'Challenger — Classic',
      format: 'SO5',
      inSeasonRequired: 0,
      leagues: ['eredivisie-nl', 'primeira-liga-pt', 'jupiler-pro-league-be', 'premiership-gb-sct', 'super-lig-tr', 'championship-gb-eng']
    },
    {
      id: 'contender_in_season',
      name: 'Contender — In-Season',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['2-bundesliga-de', 'segunda-division-es', 'serie-b-it', 'superliga-dk', 'eliteserien-no', 'bundesliga-at', 'super-league-ch', 'ekstraklasa-pl']
    },
    {
      id: 'u23_in_season',
      name: 'Under 23 — In-Season',
      format: 'SO5',
      inSeasonRequired: 4,
      u23Only: true,
      leagues: ['ALL']
    },
    {
      id: 'u23_classic',
      name: 'Under 23 — Classic',
      format: 'SO5',
      inSeasonRequired: 0,
      u23Only: true,
      leagues: ['ALL']
    },
    {
      id: 'global_all_star_so7',
      name: 'All-Star — Classic SO7 (7 vs 7)',
      format: 'SO7',
      inSeasonRequired: 0,
      leagues: ['ALL']
    }
  ]
};

window.CONFIG = CONFIG;
