import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { readArticles } from './input.ts';
import { buildCampaigns } from './group.ts';
import { loadCache, generateAll } from './generate.ts';
import { writeEditorFiles, writeGroupingReview, writeCsv } from './editor-csv.ts';
import { OUTPUT_DIR } from './config.ts';

// Usage:
//   node run.ts articles.tsv --group-only   -> only writes output/grouping-review.csv (no API calls)
//   node run.ts articles.tsv --limit 30     -> full run on the first 30 articles
//   node run.ts articles.tsv                -> full run
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'group-only': { type: 'boolean', default: false },
    'limit': { type: 'string' },
  },
});

const inputPath = positionals[0];
if (!inputPath) {
  console.error('Usage: node run.ts <articles.tsv> [--group-only] [--limit N]');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const { articles: allArticles, skipped } = readArticles(inputPath);
const articles = values.limit ? allArticles.slice(0, Number(values.limit)) : allArticles;
if (skipped.length > 0) console.warn(`Skipped ${skipped.length} input lines:\n  ${skipped.slice(0, 20).join('\n  ')}`);

let campaigns = buildCampaigns(articles);
writeGroupingReview(campaigns, OUTPUT_DIR);
printSummary('Grouping', campaigns);
if (values['group-only']) {
  console.log('Wrote output/grouping-review.csv');
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY to generate ad copy (or use --group-only).');
  process.exit(1);
}

const cachePath = new URL('ad-copy.jsonl', OUTPUT_DIR);
const adCopy = loadCache(cachePath.pathname);
await generateAll(articles, adCopy, cachePath.pathname);

// Articles without usable ad copy are left out (and listed) so the rest can be imported now.
// Re-running the script retries only those articles.
const failed = articles.filter((article) => !adCopy.has(article.url));
if (failed.length > 0) {
  const failedUrls = new Set(failed.map((article) => article.url));
  campaigns = campaigns
    .map((campaign) => ({
      ...campaign,
      adGroups: campaign.adGroups
        .map((adGroup) => ({ ...adGroup, articles: adGroup.articles.filter((article) => !failedUrls.has(article.url)) }))
        .filter((adGroup) => adGroup.articles.length > 0),
    }))
    .filter((campaign) => campaign.adGroups.length > 0);
  writeCsv(new URL('failed-articles.csv', OUTPUT_DIR), failed.map((article) => ({ ...article })));
  console.warn(`${failed.length} articles have no usable ad copy; see output/failed-articles.csv. Re-run to retry them.`);
}

writeEditorFiles(campaigns, adCopy, OUTPUT_DIR);
printSummary('Exported', campaigns);
console.log('Wrote output/1-campaigns.csv ... output/5-ads.csv. Import them into Google Ads Editor in that order.');

function printSummary(label: string, list: typeof campaigns): void {
  const adGroups = list.flatMap((campaign) => campaign.adGroups);
  const ads = adGroups.reduce((sum, adGroup) => sum + adGroup.articles.length, 0);
  const sizes = adGroups.reduce<Record<number, number>>((acc, adGroup) => {
    acc[adGroup.articles.length] = (acc[adGroup.articles.length] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`${label}: ${list.length} campaigns, ${adGroups.length} ad groups, ${ads} RSAs (ad groups by size: ${JSON.stringify(sizes)})`);
}
