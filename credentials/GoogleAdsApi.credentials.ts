import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export interface IGoogleAdsApiCredentials {
	developerToken: string;
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	customerId: string;
}

export class GoogleAdsApi implements ICredentialType {
	name = 'googleAdsApi';
	displayName = 'Google Ads API';
	documentationUrl = 'https://developers.google.com/google-ads/api';

	properties: INodeProperties[] = [
		{
			displayName: 'Developer Token',
			name: 'developerToken',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		{
			displayName: 'Refresh Token',
			name: 'refreshToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		{
			displayName: 'Customer ID',
			name: 'customerId',
			type: 'string',
			default: '',
			description: 'Google Ads Customer ID without dashes',
			required: true,
		},
	];
}
