import {
  DEFAULT_BUDGET_MICROS,
  DEFAULT_CPC_MICROS,
  DEFAULT_LOCATION_ID,
  DEFAULT_KEYWORD_MATCH_TYPE,
  MIN_HEADLINES_REQUIRED,
  MIN_DESCRIPTIONS_REQUIRED,
  MAX_HEADLINE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from '../../nodes/GoogleAds/utils/defaults.ts';

// Same defaults as the n8n Google Ads node. Google Ads Editor wants currency units, not micros.
export const CAMPAIGN_PREFIX = process.env.CAMPAIGN_PREFIX ?? 'RSA';
export const DAILY_BUDGET = DEFAULT_BUDGET_MICROS / 1_000_000;
export const MAX_CPC = DEFAULT_CPC_MICROS / 1_000_000;
export const LOCATION_ID = DEFAULT_LOCATION_ID;
export const KEYWORD_MATCH_TYPE = DEFAULT_KEYWORD_MATCH_TYPE === 'EXACT' ? 'Exact' : 'Phrase';

// Structure
export const ADS_PER_AD_GROUP = 3; // Google allows max 3 enabled RSAs per ad group
export const AD_GROUPS_PER_CAMPAIGN = Number(process.env.AD_GROUPS_PER_CAMPAIGN ?? 4);

// Ad copy
export const HEADLINES_WANTED = 15;
export const DESCRIPTIONS_WANTED = 4;
export { MIN_HEADLINES_REQUIRED, MIN_DESCRIPTIONS_REQUIRED, MAX_HEADLINE_LENGTH, MAX_DESCRIPTION_LENGTH };

// Claude
export const MODEL = process.env.MODEL ?? 'claude-opus-5-5';
export const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);
export const MAX_ATTEMPTS = 3;

export const OUTPUT_DIR = new URL('./output/', import.meta.url);
