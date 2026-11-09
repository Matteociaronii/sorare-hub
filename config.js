// SorareHub - Configuration Layer
const CONFIG = {
  CLIENT_ID: 'nb6KHL2pLACJu0KArFiJlejgfPzCQLm7hVT7_HghcGo',
  REDIRECT_URI: 'https://matteociaronii.github.io/sorare-hub/',
  AUTH_ENDPOINT: 'https://sorare.com/oauth/authorize',
  TOKEN_ENDPOINT: 'https://api.sorare.com/oauth/token',
  GRAPHQL_ENDPOINT: 'https://api.sorare.com/graphql',
  SCOPES: 'read',
  
  RULES: {
    MIN_IN_SEASON_COUNT: 4,
    SUB_FLOOR_SCORE: 35.0,
    AAS_WEIGHT: 0.65,
    PREDICTIVE_WEIGHT: 0.35
  }
};

window.CONFIG = CONFIG;
