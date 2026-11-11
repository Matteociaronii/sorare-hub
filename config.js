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
    COLLECTION_MAX_BONUS: 0.05,
    CAPTAIN_BONUS_MULTIPLIER: 1.50
  },

  WEIGHTS: {
    FLOOR_MODE: { aas: 0.72, decisive: 0.28 },
    CEILING_MODE: { aas: 0.40, decisive: 0.60 }
  },

  OFFICIAL_COMPETITIONS: [
    // --- IN-SEASON (SO5: Min 4 In-Season, Max 1 Classic - Mono-Lega Rigido) ---
    {
      id: 'premier_league_in_season',
      name: 'Premier League — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['premier-league-gb-eng']
    },
    {
      id: 'laliga_in_season',
      name: 'LaLiga — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['laliga-es']
    },
    {
      id: 'bundesliga_in_season',
      name: 'Bundesliga — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['bundesliga-de']
    },
    {
      id: 'ligue1_in_season',
      name: 'Ligue 1 — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['ligue-1-fr']
    },
    {
      id: 'championship_in_season',
      name: 'EFL Championship — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['championship-gb-eng']
    },
    {
      id: 'liga_portugal_in_season',
      name: 'Liga Portugal — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['primeira-liga-pt']
    },
    {
      id: 'jupiler_in_season',
      name: 'Jupiler Pro League — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['jupiler-pro-league-be']
    },
    {
      id: 'eredivisie_in_season',
      name: 'Eredivisie — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['eredivisie-nl']
    },
    {
      id: 'scottish_in_season',
      name: 'Scottish Premiership — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['premiership-gb-sct']
    },
    {
      id: 'mls_in_season',
      name: 'MLS — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['mls-us']
    },
    {
      id: 'j1_league_in_season',
      name: 'J1 League — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['j1-league-jp']
    },
    {
      id: 'k_league_in_season',
      name: 'K League 1 — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: ['k-league-1-kr']
    },
    {
      id: 'contender_in_season',
      name: 'Contender — In-Season (Multi-Lega Minori SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      leagues: [
        '2-bundesliga-de',
        'segunda-division-es',
        'serie-b-it',
        'superliga-dk',
        'eliteserien-no',
        'bundesliga-at',
        'super-league-ch',
        'ekstraklasa-pl'
      ]
    },

    // --- CLASSIC (SO7: 7 Titolari - Nessun vincolo di annata) ---
    {
      id: 'champions_europe_classic_so7',
      name: 'CHAMPIONS EUROPE — Classic (UEFA Champions League SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      isUefaChampions: true,
      leagues: ['uefa-champions-league']
    },
    {
      id: 'contender_europe_classic_so7',
      name: 'CONTENDER EUROPE — Classic (Europa & Conference League SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      isUefaContender: true,
      leagues: ['uefa-europa-league', 'uefa-conference-league']
    },
    {
      id: 'champion_europe_classic_so7',
      name: 'Champion Europe — Classic (Premier, Liga, Bundes, Ligue 1 SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      leagues: ['premier-league-gb-eng', 'laliga-es', 'bundesliga-de', 'ligue-1-fr']
    },
    {
      id: 'u23_classic_so7',
      name: 'Under 23 — Classic (Tutte le leghe SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      u23Only: true,
      leagues: ['ALL']
    },
    {
      id: 'all_star_classic_so7',
      name: 'All-Star — Classic (Bacino Universale a Cascata SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      leagues: ['ALL']
    }
  ]
};

window.CONFIG = CONFIG;
