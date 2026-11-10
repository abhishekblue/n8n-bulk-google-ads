import { writeFileSync } from 'node:fs';
import type { Campaign } from './group.ts';
import type { AdCopyByUrl } from './generate.ts';
import { DAILY_BUDGET, MAX_CPC, LOCATION_ID, KEYWORD_MATCH_TYPE, HEADLINES_WANTED, DESCRIPTIONS_WANTED } from './config.ts';

type Row = Record<string, string | number>;

// Google Ads Editor: Account > Import > From file. Import the files in number order.
// Header names follow the Google Ads Editor CSV column list (case and spaces don't matter there).
export function writeEditorFiles(campaigns: Campaign[], adCopy: AdCopyByUrl, outputDir: URL): void {
  const campaignRows: Row[] = [];
  const locationRows: Row[] = [];
  const adGroupRows: Row[] = [];
  const keywordRows: Row[] = [];
  const adRows: Row[] = [];

  for (const campaign of campaigns) {
    campaignRows.push({
      'Campaign': campaign.name,
      'Campaign Type': 'Search',
      'Networks': 'Google Search',
      'Budget': DAILY_BUDGET,
      'Bid Strategy Type': 'Manual CPC',
      'Campaign Status': 'Paused',
    });
    locationRows.push({ 'Campaign': campaign.name, 'Location ID': LOCATION_ID });

    for (const adGroup of campaign.adGroups) {
      adGroupRows.push({
        'Campaign': campaign.name,
        'Ad Group': adGroup.name,
        'Max CPC': MAX_CPC,
        'Ad Group Status': 'Enabled',
      });

      const keywords = new Set(adGroup.articles.map((article) => article.keyword.toLowerCase()));
      for (const keyword of keywords) {
        keywordRows.push({
          'Campaign': campaign.name,
          'Ad Group': adGroup.name,
          'Keyword': keyword,
          'Criterion Type': KEYWORD_MATCH_TYPE,
          'Status': 'Enabled',
        });
      }

      for (const article of adGroup.articles) {
        const copy = adCopy.get(article.url)!;
        const row: Row = { 'Campaign': campaign.name, 'Ad Group': adGroup.name, 'Ad type': 'Responsive search ad' };
        for (let i = 0; i < HEADLINES_WANTED; i++) row[`Headline ${i + 1}`] = copy.headlines[i] ?? '';
        for (let i = 0; i < DESCRIPTIONS_WANTED; i++) row[`Description ${i + 1}`] = copy.descriptions[i] ?? '';
        row['Final URL'] = article.url;
        row['Status'] = 'Enabled';
        adRows.push(row);
      }
    }
  }

  writeCsv(new URL('1-campaigns.csv', outputDir), campaignRows);
  writeCsv(new URL('2-locations.csv', outputDir), locationRows);
  writeCsv(new URL('3-ad-groups.csv', outputDir), adGroupRows);
  writeCsv(new URL('4-keywords.csv', outputDir), keywordRows);
  writeCsv(new URL('5-ads.csv', outputDir), adRows);
}

// Human-readable list of what goes where, for checking the grouping before generating anything.
export function writeGroupingReview(campaigns: Campaign[], outputDir: URL): void {
  const rows: Row[] = [];
  for (const campaign of campaigns) {
    for (const adGroup of campaign.adGroups) {
      for (const article of adGroup.articles) {
        rows.push({
          'Campaign': campaign.name,
          'Ad Group': adGroup.name,
          'Keyword': article.keyword,
          'Title': article.title,
          'URL': article.url,
        });
      }
    }
  }
  writeCsv(new URL('grouping-review.csv', outputDir), rows);
}

export function writeCsv(path: URL, rows: Row[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))].map((cells) =>
    cells.map((cell) => escapeCell(String(cell))).join(','),
  );
  writeFileSync(path, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
}

function escapeCell(value: string): string {
  const flat = value.replace(/[\r\n\t]+/g, ' ');
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}
