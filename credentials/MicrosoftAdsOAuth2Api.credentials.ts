import type { Icon, ICredentialType, INodeProperties, ICredentialTestRequest } from 'n8n-workflow';

export class MicrosoftAdsOAuth2Api implements ICredentialType {
	name = 'microsoftAdsOAuth2Api';

	displayName = 'Microsoft Ads API';

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://login.microsoftonline.com/common/oauth2/v2.0',
			url: '/token',
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'grant_type=refresh_token&client_id={{$credentials.clientId}}&client_secret={{$credentials.clientSecret}}&refresh_token={{$credentials.refreshToken}}&scope=https%3A%2F%2Fads.microsoft.com%2Fmsads.manage%20offline_access',
		},
	};

	// eslint-disable-next-line @n8n/community-nodes/icon-validation
	icon: Icon = 'file:../icons/microsoft-ads.svg';

	documentationUrl = 'https://learn.microsoft.com/en-us/advertising/guides/authentication-oauth';

	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'OAuth2 Client ID from Azure App Registration',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			description: 'OAuth2 Client Secret from Azure App Registration',
		},
		{
			displayName: 'Refresh Token',
			name: 'refreshToken',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			description: 'Use the get-microsoft-refresh-token.js script to obtain this',
		},
		{
			displayName: 'Developer Token',
			name: 'developerToken',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			description:
				'From Microsoft Advertising > Tools > Developer Token. IMPORTANT: The Developer Token and the OAuth user must belong to the same Microsoft Ads account hierarchy. Mismatched accounts will cause error 105 (InvalidCredentials).',
		},
		{
			displayName: 'Customer ID',
			name: 'customerId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your Customer ID from Microsoft Advertising (top-right in the UI)',
		},
		{
			displayName: 'Account ID',
			name: 'customerAccountId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your Account ID from Microsoft Advertising',
		},
	];
}
