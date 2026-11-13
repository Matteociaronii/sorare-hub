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
    // === 1. CAMPIONATI DOMESTICI SINGOLI IN-SEASON (SO5: Min 4 In-Season, Mono-Lega) ===
    {
      id: 'premier_league_in_season',
      name: 'Premier League — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['premier-league-gb-eng', 'premier-league']
    },
    {
      id: 'serie_a_in_season',
      name: 'Serie A — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['serie-a-it', 'serie-a']
    },
    {
      id: 'laliga_in_season',
      name: 'LaLiga — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['laliga-es', 'laliga', 'primera-division-es', 'primera-division']
    },
    {
      id: 'bundesliga_in_season',
      name: 'Bundesliga — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['bundesliga-de', 'bundesliga']
    },
    {
      id: 'ligue1_in_season',
      name: 'Ligue 1 — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['ligue-1-fr', 'ligue-1']
    },
    {
      id: 'championship_in_season',
      name: 'EFL Championship — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['championship-gb-eng', 'efl-championship', 'championship']
    },
    {
      id: 'liga_portugal_in_season',
      name: 'Liga Portugal — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['primeira-liga-pt', 'primeira-liga', 'liga-portugal']
    },
    {
      id: 'jupiler_in_season',
      name: 'Jupiler Pro League — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['jupiler-pro-league-be', 'jupiler-pro-league', 'first-division-a']
    },
    {
      id: 'eredivisie_in_season',
      name: 'Eredivisie — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['eredivisie-nl', 'eredivisie']
    },
    {
      id: 'scottish_in_season',
      name: 'Scottish Premiership — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['premiership-gb-sct', 'scottish-premiership']
    },
    {
      id: 'mls_in_season',
      name: 'MLS — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['mls-us', 'mls', 'major-league-soccer']
    },
    {
      id: 'j1_league_in_season',
      name: 'J1 League — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['j1-league-jp', 'j1-league']
    },
    {
      id: 'k_league_in_season',
      name: 'K League 1 — In-Season (SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: ['k-league-1-kr', 'k-league-1']
    },
    {
      id: 'challenger_in_season',
      name: 'Challenger — In-Season (Liga Portugal, Eredivisie, JPL, Scozia SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: [
        'primeira-liga-pt', 'primeira-liga', 'liga-portugal',
        'eredivisie-nl', 'eredivisie',
        'jupiler-pro-league-be', 'jupiler-pro-league', 'first-division-a',
        'premiership-gb-sct', 'scottish-premiership',
        'super-lig-tr', 'super-lig',
        'superliga-dk', 'danish-superliga',
        'super-league-ch', 'swiss-super-league',
        'eliteserien-no', 'eliteserien'
      ]
    },
    {
      id: 'contender_in_season',
      name: 'Contender — In-Season (Leghe Minori SO5)',
      format: 'SO5',
      inSeasonRequired: 4,
      allowNationalTeams: false,
      leagues: [
        '2-bundesliga-de',
        '2-bundesliga',
        'segunda-division-es',
        'segunda-division',
        'serie-b-it',
        'serie-b',
        'superliga-dk',
        'danish-superliga',
        'eliteserien-no',
        'eliteserien',
        'bundesliga-at',
        'austrian-bundesliga',
        'super-league-ch',
        'swiss-super-league',
        'ekstraklasa-pl',
        'ekstraklasa',
        'supersport-hnl',
        'prva-hnl',
        '1-hnl-hr',
        'ligue-2-fr',
        'ligue-2'
      ]
    },

    // === 2. COMPETIZIONI CLASSIC (SO7: 7 Titolari, Nessun vincolo di annata) ===
    {
      id: 'champions_europe_classic_so7',
      name: 'CHAMPIONS EUROPE — Classic (UEFA Champions League SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      isUefaChampions: true,
      allowNationalTeams: false,
      leagues: ['uefa-champions-league']
    },
    {
      id: 'contender_europe_classic_so7',
      name: 'CONTENDER EUROPE — Classic (Europa & Conference League SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      isUefaContender: true,
      allowNationalTeams: false,
      leagues: ['uefa-europa-league', 'uefa-conference-league', 'uefa-europa-conference-league']
    },
    {
      id: 'champion_europe_classic_so7',
      name: 'Champion Europe — Classic (Premier, Serie A, Liga, Bundes, Ligue 1 SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      allowNationalTeams: false,
      leagues: [
        'premier-league-gb-eng', 'premier-league',
        'serie-a-it', 'serie-a',
        'laliga-es', 'laliga', 'primera-division-es', 'primera-division',
        'bundesliga-de', 'bundesliga',
        'ligue-1-fr', 'ligue-1'
      ]
    },
    {
      id: 'u23_classic_so7',
      name: 'Under 23 — Classic (Tutti gli U23 SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      u23Only: true,
      allowNationalTeams: true,
      leagues: ['ALL']
    },
    {
      id: 'all_star_classic_so7',
      name: 'All-Star — Classic (Bacino Universale a Cascata SO7)',
      format: 'SO7',
      inSeasonRequired: 0,
      allowNationalTeams: true,
      leagues: ['ALL']
    }
  ]
};

window.CONFIG = CONFIG;
