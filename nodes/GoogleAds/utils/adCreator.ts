import { Customer } from 'google-ads-api'

export async function createResponsiveSearchAd(
  customer: Customer,
  adGroupResourceName: string,
  headlines: string[],
  descriptions: string[],
  finalUrl: string,
  path1: string | undefined,
  path2: string | undefined,
): Promise<string> {
  // 1. Convert headlines array into objects with format: { text: "headline text" }
  const headlineAssets = headlines.map((text) => ({ text }));

  // 2. Convert descriptions array into objects with format: { text: "description text" }
  const descriptionAssets = descriptions.map((text) => ({ text }));

  // 3. Create an operation object
  const operation = {
    ad_group: adGroupResourceName,
    status: 'ENABLED',
    ad: {
			final_urls: [finalUrl],
      responsive_search_ad: {
        headlines: headlineAssets,
        descriptions: descriptionAssets,
        path1: path1,
        path2: path2,
      },
    },
  };

	console.log('🔍 Inside adCreator.ts - finalUrl received:', finalUrl);
	console.log('🔍 Headlines assets:', JSON.stringify(headlineAssets));
	console.log('🔍 Description assets:', JSON.stringify(descriptionAssets));
	console.log('🔍 Complete operation object:', JSON.stringify(operation, null, 2));


  // 4. Call: await customer.adGroupAds.create([operation])
  const results = await customer.adGroupAds.create([operation as any])

  // 5. Store result and check if results[0].resource_name exists
  // 6. If not, throw error: "Failed to create responsive search ad: No resource name returned."
	if (!results.results || !results.results[0] || !results.results[0].resource_name) {
    throw new Error('Failed to create responsive search ad: No resource name returned.');
  }

  // 7. Return the resource_name
	return results.results[0].resource_name;
}
