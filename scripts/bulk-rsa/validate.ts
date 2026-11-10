import {
  HEADLINES_WANTED,
  DESCRIPTIONS_WANTED,
  MAX_HEADLINE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from './config.ts';

export interface AdCopy {
  headlines: string[];
  descriptions: string[];
}

// Keeps only lines Google Ads will accept; drops the rest instead of failing the whole ad.
export function cleanAdCopy(raw: AdCopy): AdCopy {
  return {
    headlines: cleanLines(raw.headlines, MAX_HEADLINE_LENGTH, true).slice(0, HEADLINES_WANTED),
    descriptions: cleanLines(raw.descriptions, MAX_DESCRIPTION_LENGTH, false).slice(0, DESCRIPTIONS_WANTED),
  };
}

function cleanLines(lines: string[], maxLength: number, isHeadline: boolean): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const text = line.replace(/\s+/g, ' ').trim();
    const key = text.toLowerCase();
    if (text.length === 0 || text.length > maxLength || seen.has(key)) continue;
    if (isHeadline && text.includes('!')) continue; // Google doesn't allow "!" in headlines
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) continue; // no emoji
    seen.add(key);
    result.push(text);
  }
  return result;
}

export function isComplete(copy: AdCopy): boolean {
  return copy.headlines.length >= HEADLINES_WANTED && copy.descriptions.length >= DESCRIPTIONS_WANTED;
}

export function isBetter(a: AdCopy, b: AdCopy | undefined): boolean {
  if (!b) return true;
  return a.headlines.length + a.descriptions.length > b.headlines.length + b.descriptions.length;
}
