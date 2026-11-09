import type { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { microsoftAdsApiRequest, ENDPOINTS } from '../shared/transport';

export async function createResponsiveSearchAd(
	context: IExecuteFunctions,
	adGroupId: string,
	headlines: string[],
	descriptions: string[],
	finalUrl: string,
	path1: string | undefined,
	path2: string | undefined,
	itemIndex: number,
): Promise<IDataObject> {
	// Microsoft Ads RSA format: AssetLink array with TextAsset objects
	// Docs: https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad
	const headlineAssets = headlines.map((text) => ({
		Asset: { Type: 'TextAsset', Text: text },
	}));

	const descriptionAssets = descriptions.map((text) => ({
		Asset: { Type: 'TextAsset', Text: text },
	}));

	const ad: IDataObject = {
		Type: 'ResponsiveSearch',
		Headlines: headlineAssets,
		Descriptions: descriptionAssets,
		FinalUrls: [finalUrl],
		Status: 'Active',
	};

	if (path1) {
		ad.Path1 = path1;
	}
	if (path2) {
		ad.Path2 = path2;
	}

	const response = await microsoftAdsApiRequest.call(
		context,
		'POST',
		ENDPOINTS.adCreate,
		{ AdGroupId: adGroupId, Ads: [ad] },
		itemIndex,
	);

	return response as IDataObject;
}
