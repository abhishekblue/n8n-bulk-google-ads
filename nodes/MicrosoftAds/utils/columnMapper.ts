export function getCampaignName(row: Record<string, any>): string | undefined {
  const campaignNameKeys = ['campaignName', 'campaign_name', 'CampaignName', 'Campaign Name'];
  for (const key of campaignNameKeys) {
    if (row[key] !== undefined) {
      return String(row[key]);
    }
  }
  return undefined;
}

export function getAdGroupName(row: Record<string, any>): string | undefined {
  const adGroupNameKeys = ['adGroupName', 'ad_group_name', 'AdGroupName', 'Ad Group Name'];
  for (const key of adGroupNameKeys) {
    if (row[key] !== undefined) {
      return String(row[key]);
    }
  }
  return undefined;
}

export function getHeadlines(row: Record<string, any>): string[] {
  const headlines: string[] = [];
  // Check for individual headline columns (headline1-15)
  for (let i = 1; i <= 15; i++) {
    const key = `headline${i}`;
    if (row[key] !== undefined) {
      headlines.push(String(row[key]));
    }
  }
  // Check for a single headline column with line breaks or commas
  const singleHeadlineKey = ['headlines', 'Headlines', 'Headline'];
  for (const key of singleHeadlineKey) {
    if (row[key] !== undefined && typeof row[key] === 'string') {
      const parts = String(row[key]).split(' || ').map(h => h.trim().replace(/\./g, '')).filter(h => h.length > 0);
      headlines.push(...parts);
    }
  }
  return headlines;
}

export function getDescriptions(row: Record<string, any>): string[] {
  const descriptions: string[] = [];
  // Check for individual description columns (description1-4)
  for (let i = 1; i <= 4; i++) {
    const key = `description${i}`;
    if (row[key] !== undefined) {
      descriptions.push(String(row[key]));
    }
  }
  // Check for a single description column with line breaks or commas
  const singleDescriptionKey = ['descriptions', 'Descriptions', 'Description'];
  for (const key of singleDescriptionKey) {
    if (row[key] !== undefined && typeof row[key] === 'string') {
      const parts = String(row[key]).split(' || ').map(h => h.trim().replace(/\./g, '')).filter(h => h.length > 0);
      descriptions.push(...parts);
    }
  }
  return descriptions;
}

export function getKeywords(row: Record<string, any>): string[] {
  const keywords: string[] = [];
  const keywordKeys = ['keywords', 'Keywords', 'Keyword'];
  for (const key of keywordKeys) {
    if (row[key] !== undefined) {
      if (Array.isArray(row[key])) {
        keywords.push(...row[key].map((k: string) => String(k).trim()).filter(k => k.length > 0));
      } else if (typeof row[key] === 'string') {
        const parts = String(row[key]).split(/[\n,]/).map(k => k.trim()).filter(k => k.length > 0);
        keywords.push(...parts);
      }
    }
  }
  return keywords;
}

export function getOtherField(row: Record<string, any>, fieldName: string): string | number | undefined {
  const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const normalizedRowKeys = Object.keys(row).reduce((acc: Record<string, any>, key: string) => {
    acc[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[key];
    return acc;
  }, {});

  if (normalizedRowKeys[normalizedFieldName] !== undefined) {
    return normalizedRowKeys[normalizedFieldName];
  }

  const variations = [
    fieldName,
    fieldName.toLowerCase(),
    fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
    fieldName.replace(/([A-Z])/g, '_$1').toLowerCase(),
    fieldName.replace(/([A-Z])/g, ' $1').trim(),
  ];

  for (const key of variations) {
    if (row[key] !== undefined) {
      return row[key];
    }
  }
  return undefined;
}

export function mapColumnData(row: Record<string, any>) {
  return {
    campaignName: getCampaignName(row),
    adGroupName: getAdGroupName(row),
    budget: getOtherField(row, 'budget'),
    headlines: getHeadlines(row),
    descriptions: getDescriptions(row),
    finalUrl: getOtherField(row, 'finalUrl'),
    path1: getOtherField(row, 'path1'),
    path2: getOtherField(row, 'path2'),
    keywords: getKeywords(row),
    location: getOtherField(row, 'location'),
    cpcStrategy: getOtherField(row, 'cpcStrategy'),
    matchType: getOtherField(row, 'matchType'),
  };
}
