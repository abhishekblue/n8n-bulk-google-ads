import { readFileSync } from 'node:fs';

export interface Article {
  url: string;
  title: string;
  keyword: string;
  category: string;
}

// Reads a tab-separated file: URL <tab> Title <tab> Keyword. A header row is skipped if present.
export function readArticles(path: string): { articles: Article[]; skipped: string[] } {
  const lines = readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const articles: Article[] = [];
  const skipped: string[] = [];
  const seenUrls = new Set<string>();

  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0) continue;
    const [url = '', title = '', keyword = ''] = line.split('\t').map((cell) => cell.trim());

    if (index === 0 && !url.startsWith('http')) continue; // header row

    if (!url.startsWith('http') || title.length === 0 || keyword.length === 0) {
      skipped.push(`line ${index + 1}: missing URL, title or keyword`);
      continue;
    }
    if (seenUrls.has(url)) {
      skipped.push(`line ${index + 1}: duplicate URL ${url}`);
      continue;
    }
    seenUrls.add(url);
    articles.push({ url, title, keyword, category: getCategory(url) });
  }
  return { articles, skipped };
}

// https://ponly.com/faith/bible-verses-about-love/ -> "Faith"
function getCategory(url: string): string {
  const firstSegment = new URL(url).pathname.split('/').filter(Boolean)[0];
  if (!firstSegment || firstSegment.length === 0) return 'General';
  return firstSegment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
