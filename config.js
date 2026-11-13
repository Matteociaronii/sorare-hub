// SorareHub - Official Sorare 26/27 Competitions Configuration (Leagues + European Cups + All-Star + U23)
const CONFIG = {
  CLIENT_ID: 'Be92I11a5-W_p21_bB25f3w13e4y5N6x7M8z9A0b1C2',
  REDIRECT_URI: 'https://matteociaronii.github.io/sorare-hub/',
  TOKEN_ENDPOINT: 'https://sorare-oauth-proxy.matteo-ciaroni03.workers.dev',
  AUTH_ENDPOINT: 'https://sorare.com/oauth/authorize',
  SCOPES: 'read_cards',

  OFFICIAL_COMPETITIONS: [
    {
      id: 'all_star',
      name: 'All-Star — Classic (Bacino Universale SO7)',
      format: 'SO7',
      leagues: ['ALL'],
      inSeasonRequired: 0,
      allowNationalTeams: true
    },
    {
      id: 'u23',
      name: 'Under 23 — Classic (SO5)',
      format: 'SO5',
      leagues: ['ALL'],
      u23Only: true,
      inSeasonRequired: 0,
      allowNationalTeams: true
    },
    {
      id: 'champion_europe',
      name: 'Champion Europe — In-Season (Top 5 Campionati SO5)',
      format: 'SO5',
      leagues: ['premier-league', 'serie-a', 'laliga', 'la-liga', 'primera-division', 'bundesliga', 'ligue-1'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'champion_classic',
      name: 'Champion Europe — Classic (Top 5 Campionati SO7)',
      format: 'SO7',
      leagues: ['premier-league', 'serie-a', 'laliga', 'la-liga', 'primera-division', 'bundesliga', 'ligue-1'],
      inSeasonRequired: 0,
      allowNationalTeams: false
    },
    {
      id: 'ucl_champions',
      name: 'European Champion — UEFA Champions League (SO5)',
      format: 'SO5',
      competitionType: 'UCL',
      leagues: ['uefa-champions-league', 'champions-league'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'uel_uecl_contender',
      name: 'European Contender — UEFA Europa & Conference League (SO5)',
      format: 'SO5',
      competitionType: 'UEL_UECL',
      leagues: ['uefa-europa-league', 'europa-league', 'uefa-europa-conference-league', 'conference-league'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'challenger_europe',
      name: 'Challenger — In-Season (Liga Portugal, Eredivisie, JPL, Scozia SO5)',
      format: 'SO5',
      leagues: ['primeira-liga', 'liga-portugal', 'eredivisie', 'jupiler-pro-league', 'first-division-a', 'scottish-premiership', 'super-lig', 'danish-superliga'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'contender',
      name: 'Contender — In-Season (Austria, Croazia, 2.BL, Ligue 2 SO5)',
      format: 'SO5',
      leagues: ['austrian-bundesliga', 'supersport-hnl', 'prva-hnl', '2-bundesliga', 'ligue-2'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'premier_league',
      name: 'Premier League — In-Season (SO5)',
      format: 'SO5',
      leagues: ['premier-league'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'serie_a',
      name: 'Serie A — In-Season (SO5)',
      format: 'SO5',
      leagues: ['serie-a'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'laliga',
      name: 'La Liga — In-Season (SO5)',
      format: 'SO5',
      leagues: ['laliga', 'la-liga', 'primera-division'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'bundesliga',
      name: 'Bundesliga — In-Season (SO5)',
      format: 'SO5',
      leagues: ['bundesliga'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'ligue_1',
      name: 'Ligue 1 — In-Season (SO5)',
      format: 'SO5',
      leagues: ['ligue-1'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'liga_portugal',
      name: 'Liga Portugal — In-Season (SO5)',
      format: 'SO5',
      leagues: ['primeira-liga', 'liga-portugal'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    },
    {
      id: 'eredivisie',
      name: 'Eredivisie — In-Season (SO5)',
      format: 'SO5',
      leagues: ['eredivisie'],
      inSeasonRequired: 4,
      allowNationalTeams: false
    }
  ]
};

window.CONFIG = CONFIG;
