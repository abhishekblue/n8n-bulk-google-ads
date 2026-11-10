import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { Article } from './input.ts';
import { cleanAdCopy, isBetter, isComplete, type AdCopy } from './validate.ts';
import {
  MODEL,
  CONCURRENCY,
  MAX_ATTEMPTS,
  HEADLINES_WANTED,
  DESCRIPTIONS_WANTED,
  MAX_HEADLINE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MIN_HEADLINES_REQUIRED,
  MIN_DESCRIPTIONS_REQUIRED,
} from './config.ts';

const AdCopySchema = z.object({
  headlines: z.array(z.string()),
  descriptions: z.array(z.string()),
});

const SYSTEM_PROMPT = `You write Google Ads responsive search ad copy for article pages.

Rules:
- Exactly ${HEADLINES_WANTED} headlines, each at most ${MAX_HEADLINE_LENGTH} characters including spaces. Count carefully.
- Exactly ${DESCRIPTIONS_WANTED} descriptions, each at most ${MAX_DESCRIPTION_LENGTH} characters including spaces.
- Every headline must be different in wording and angle; Google mixes them in any order, so each must make sense on its own.
- Put the search keyword (or a natural close variant) in at least 3 headlines when it fits the length limit.
- Describe what the reader gets from the article. Do not promise anything the article title doesn't support.
- No exclamation marks in headlines, no emoji, no ALL CAPS words, no phone numbers, no prices, no "click here".
- Title Case for headlines, sentence case for descriptions ending with a period.`;

export type AdCopyByUrl = Map<string, AdCopy>;

// Results are appended to a JSONL cache so a crashed or re-run job skips finished articles.
export function loadCache(cachePath: string): AdCopyByUrl {
  const cache: AdCopyByUrl = new Map();
  if (!existsSync(cachePath)) return cache;
  for (const line of readFileSync(cachePath, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue;
    const entry = JSON.parse(line) as { url: string } & AdCopy;
    cache.set(entry.url, { headlines: entry.headlines, descriptions: entry.descriptions });
  }
  return cache;
}

export async function generateAll(articles: Article[], cache: AdCopyByUrl, cachePath: string): Promise<void> {
  const client = new Anthropic({ maxRetries: 6 });
  const todo = articles.filter((article) => !cache.has(article.url));
  const total = todo.length;
  let done = 0;
  let failed = 0;
  console.log(`Ad copy: ${articles.length - todo.length} cached, ${todo.length} to generate (model ${MODEL}, ${CONCURRENCY} parallel)`);

  const worker = async () => {
    while (todo.length > 0) {
      const article = todo.shift()!;
      const copy = await generateForArticle(client, article);
      if (copy && copy.headlines.length >= MIN_HEADLINES_REQUIRED && copy.descriptions.length >= MIN_DESCRIPTIONS_REQUIRED) {
        cache.set(article.url, copy);
        appendFileSync(cachePath, JSON.stringify({ url: article.url, ...copy }) + '\n');
      } else {
        failed++;
      }
      done++;
      if (done % 50 === 0 || done === total) {
        console.log(`  ${done}/${total} done, ${failed} failed`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function generateForArticle(client: Anthropic, article: Article): Promise<AdCopy | undefined> {
  let best: AdCopy | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: betaZodOutputFormat(AdCopySchema) },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Article title: ${article.title}\nSearch keyword: ${article.keyword}\nLanding page: ${article.url}`,
          },
        ],
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        console.warn(`  ${article.url}: no usable output (stop_reason ${response.stop_reason})`);
        continue;
      }
      const copy = cleanAdCopy(response.parsed_output);
      if (isBetter(copy, best)) best = copy;
      if (isComplete(copy)) return copy;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        throw error; // no point retrying 10k articles with a bad key
      }
      if (error instanceof Anthropic.APIError) {
        console.warn(`  ${article.url}: API error ${error.status}: ${error.message}`);
      } else {
        console.warn(`  ${article.url}: ${(error as Error).message}`);
      }
    }
  }
  return best;
}
