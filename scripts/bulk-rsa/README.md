# bulk-rsa

Turns a list of articles into Google Ads Editor import files: campaigns → ad groups (3 articles each) → 1 responsive search ad per article, with ad copy written by Claude.

## Input

Tab-separated file, one article per line (header row optional):

```
URL	Title	Keyword
https://ponly.com/faith/bible-verses-about-love/	Bible Verses About Love: Scripture for Giving and Receiving Love	bible verses about love
```

## Run

```bash
npm install
npm run group -- articles.tsv                 # grouping only, no API calls -> output/grouping-review.csv
export ANTHROPIC_API_KEY=...
npm start -- articles.tsv --limit 30          # test run on 30 articles
npm start -- articles.tsv                     # full run
```

Generated ad copy is cached in `output/ad-copy.jsonl`, so a stopped run continues where it left off. Articles that still fail are listed in `output/failed-articles.csv` and retried on the next run.

Settings (env vars): `MODEL` (default `claude-opus-5-5`), `CONCURRENCY` (default 8), `AD_GROUPS_PER_CAMPAIGN` (default 4), `CAMPAIGN_PREFIX` (default `RSA`).
Budget, max CPC, location and match type come from `nodes/GoogleAds/utils/defaults.ts`.

## Import into Google Ads Editor

Account → Import → From file, in this order: `1-campaigns.csv`, `2-locations.csv`, `3-ad-groups.csv`, `4-keywords.csv`, `5-ads.csv`. Review, then Post. Campaigns are created **Paused**.
