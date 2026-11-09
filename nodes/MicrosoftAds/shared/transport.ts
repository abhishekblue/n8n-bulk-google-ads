import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// All endpoint paths in one place — easy to change if any are wrong
export const ENDPOINTS = {
	campaignCreate: '/Campaigns',
	campaignQuery: '/Campaigns/QueryByAccountId', // CONFIRMED working
	campaignUpdate: '/Campaigns/Update',
	campaignDelete: '/Campaigns/Delete',
	adGroupCreate: '/AdGroups',
	adGroupQuery: '/AdGroups/QueryByCampaignId',
	adCreate: '/Ads',
	keywordCreate: '/Keywords',
	campaignCriterion: '/CampaignCriterions',
};

async function getAccessToken(
	context: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<string> {
	const credentials = await context.getCredentials('microsoftAdsOAuth2Api');

	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		client_id: credentials.clientId as string,
		client_secret: credentials.clientSecret as string,
		refresh_token: credentials.refreshToken as string,
		scope: 'https://ads.microsoft.com/msads.manage offline_access',
	});

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: TOKEN_URL,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
		json: true,
	};

	const response = await context.helpers.httpRequest(options);

	if (!response?.access_token) {
		throw new NodeOperationError(
			context.getNode(),
			`Failed to get access token: ${JSON.stringify(response)}`,
		);
	}

	return response.access_token as string;
}

export async function microsoftAdsApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	itemIndex: number = 0,
) {
	const credentials = await this.getCredentials('microsoftAdsOAuth2Api');
	const accessToken = await getAccessToken(this);

	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${endpoint}`,
		body,
		json: true,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`,
			DeveloperToken: credentials.developerToken as string,
			CustomerId: credentials.customerId as string,
			CustomerAccountId: credentials.customerAccountId as string,
		},
	};

	try {
		const response = await this.helpers.httpRequest(options);

		// Check for Microsoft Ads error format in successful HTTP responses
		if (response?.Errors && Array.isArray(response.Errors) && response.Errors.length > 0) {
			const errors = response.Errors.map(
				(e: { Code?: number; Message?: string }) => `[${e.Code}] ${e.Message}`,
			).join('; ');
			throw new NodeOperationError(
				this.getNode(),
				`Microsoft Ads API error: ${errors}`,
				{ itemIndex },
			);
		}

		return response;
	} catch (error: unknown) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		// Try to extract Microsoft error details from HTTP error responses
		const err = error as Record<string, unknown>;
		let message = (err.message as string) || 'Unknown error';

		// Check multiple places where Microsoft error details might be
		const bodyStr = (err.cause as Record<string, unknown>)?.body as string
			|| (err.response as Record<string, unknown>)?.body as string
			|| err.body as string
			|| '';

		if (bodyStr) {
			try {
				const parsed = JSON.parse(bodyStr);
				if (parsed.Errors && Array.isArray(parsed.Errors)) {
					const details = parsed.Errors.map(
						(e: { Code?: number; Message?: string }) => `[${e.Code}] ${e.Message}`,
					).join('; ');
					message = `Microsoft Ads API error: ${details}`;
				}
			} catch {
				// Body wasn't JSON, use original message
			}
		}

		// Append endpoint info so we know which call failed
		message = `${message} [endpoint: ${endpoint}]`;

		throw new NodeOperationError(this.getNode(), message, { itemIndex });
	}
}
