import {
  MIN_HEADLINES_REQUIRED,
  MIN_DESCRIPTIONS_REQUIRED,
  MAX_HEADLINE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from './defaults';

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

export function validateAdData(
  campaignName: string | undefined,
  adGroupName: string | undefined,
  budget: number | undefined,
  headlines: string[],
  descriptions: string[],
  finalUrl: string | undefined,
): void {
  if (!campaignName || campaignName.trim().length === 0) {
    throw new Error('Validation Error: Campaign name is required.');
  }

  if (!adGroupName || adGroupName.trim().length === 0) {
    throw new Error('Validation Error: Ad Group name is required.');
  }

  if (typeof budget !== 'number' || budget <= 0) {
    throw new Error('Validation Error: Budget must be a positive number.');
  }

  if (headlines.length < MIN_HEADLINES_REQUIRED) {
    throw new Error(`Validation Error: At least ${MIN_HEADLINES_REQUIRED} headlines are required.`);
  }
  for (const headline of headlines) {
    if (headline.length > MAX_HEADLINE_LENGTH) {
      throw new Error(`Validation Error: Headline "${headline}" exceeds maximum length of ${MAX_HEADLINE_LENGTH} characters.`);
    }
  }

  if (descriptions.length < MIN_DESCRIPTIONS_REQUIRED) {
    throw new Error(`Validation Error: At least ${MIN_DESCRIPTIONS_REQUIRED} descriptions are required.`);
  }
  for (const description of descriptions) {
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Validation Error: Description "${description}" exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters.`);
    }
  }

  if (!finalUrl || typeof finalUrl !== 'string' || !isValidUrl(finalUrl)) {
    throw new Error('Validation Error: A valid Final URL is required.');
  }
}
