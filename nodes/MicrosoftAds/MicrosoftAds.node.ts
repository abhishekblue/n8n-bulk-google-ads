import {
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IDataObject,
	NodeOperationError,
} from 'n8n-workflow';

import { microsoftAdsApiRequest, ENDPOINTS } from './shared/transport';
import { mapColumnData } from './utils/columnMapper';
import { DEFAULT_DAILY_BUDGET, DEFAULT_CPC_BID, DEFAULT_LOCATION_ID, DEFAULT_CPC_STRATEGY, DEFAULT_KEYWORD_MATCH_TYPE } from './utils/defaults';
import { validateAdData } from './utils/dataValidator';
import { createResponsiveSearchAd } from './utils/adCreator';

// Helper function to normalize column names for robust comparison
function normalizeColumnName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class MicrosoftAds implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Microsoft Ads for L4M',
		name: 'microsoftAds',
		icon: 'file:microsoftAds.svg',
		group: ['transform'],
		version: 1,
		description: 'Create Microsoft Ads campaigns, ad groups, responsive search ads, and keywords',
		defaults: {
			name: 'Microsoft Ads',
		},
		usableAsTool: true,
		inputs: ['main', 'main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'microsoftAdsOAuth2Api',
				required: true,
			},
		],
		properties: [],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const input0 = this.getInputData(0);
		const input1 = this.getInputData(1);

		if (!input0 || input0.length === 0) {
			throw new NodeOperationError(this.getNode(), 'First input (Input 0) is missing or empty. Please ensure data is connected to the first input.');
		}
		if (!input1 || input1.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Second input (Input 1) is missing or empty. Please ensure data is connected to the second input.');
		}

		let sidItems: INodeExecutionData[];
		let sonuItems: INodeExecutionData[];

		// Detect which input is which sheet
		const firstInput0Item = input0[0]?.json || {};
		const firstInput1Item = input1[0]?.json || {};

		const input0ColumnNames = Object.keys(firstInput0Item).map(normalizeColumnName);
		const input1ColumnNames = Object.keys(firstInput1Item).map(normalizeColumnName);

		const sonuIndicators = ['keywords', 'finalurl'];
		const sidIndicators = ['campaignname', 'budget'];

		const isInput0Sonu = sonuIndicators.some(indicator => input0ColumnNames.includes(indicator));
		const isInput0Sid = sidIndicators.some(indicator => input0ColumnNames.includes(indicator));

		const isInput1Sonu = sonuIndicators.some(indicator => input1ColumnNames.includes(indicator));
		const isInput1Sid = sidIndicators.some(indicator => input1ColumnNames.includes(indicator));

		if (isInput0Sonu && isInput1Sid) {
			sonuItems = input0;
			sidItems = input1;
		} else if (isInput0Sid && isInput1Sonu) {
			sidItems = input0;
			sonuItems = input1;
		} else {
			throw new NodeOperationError(
				this.getNode(),
				`Could not identify sheet types.
				Input 0 columns: [${Object.keys(firstInput0Item).join(', ')}]
				Input 1 columns: [${Object.keys(firstInput1Item).join(', ')}]
				Please ensure one sheet contains any of "${sonuIndicators.join('", "')}" (Sonu sheet) and the other contains any of "${sidIndicators.join('", "')}" (Sid sheet).`,
			);
		}

		const results: INodeExecutionData[] = [];
		const totalRows = Math.min(sidItems.length, sonuItems.length);

		const credentials = await this.getCredentials('microsoftAdsOAuth2Api');
		const accountId = credentials.customerAccountId as string;

		for (let itemIndex = 0; itemIndex < totalRows; itemIndex++) {
			let campaignId: string | undefined;
			let adGroupId: string | undefined;
			let campaignName: string | undefined;
			let errorMessage = '';

			try {
				const mergedInputData = {
					...sidItems[itemIndex].json,
					...sonuItems[itemIndex].json,
				};

				// Use columnMapper to extract data from sheets
				const mappedData = mapColumnData(mergedInputData);

				campaignName = (mappedData.campaignName as string) || 'New Campaign';
				const adGroupName: string = (mappedData.adGroupName as string) || 'New Ad Group';
				const budget: number = mappedData.budget !== undefined ? Number(mappedData.budget) : DEFAULT_DAILY_BUDGET;
				const headlines: string[] = mappedData.headlines && Array.isArray(mappedData.headlines) ? mappedData.headlines as string[] : [];
				const descriptions: string[] = mappedData.descriptions && Array.isArray(mappedData.descriptions) ? mappedData.descriptions as string[] : [];
				const finalUrl: string = (mappedData.finalUrl as string) || 'http://www.example.com';
				const path1: string | undefined = mappedData.path1 !== undefined ? String(mappedData.path1) : undefined;
				const path2: string | undefined = mappedData.path2 !== undefined ? String(mappedData.path2) : undefined;
				const keywords: string[] = mappedData.keywords && Array.isArray(mappedData.keywords) ? mappedData.keywords as string[] : [];
				const location: string = mappedData.location !== undefined ? String(mappedData.location) : DEFAULT_LOCATION_ID;
				const cpcStrategy: string = mappedData.cpcStrategy !== undefined ? String(mappedData.cpcStrategy) : DEFAULT_CPC_STRATEGY;
				const matchType: string = mappedData.matchType !== undefined ? String(mappedData.matchType) : DEFAULT_KEYWORD_MATCH_TYPE;

				// Validate data before API calls
				validateAdData(campaignName, adGroupName, budget, headlines, descriptions, finalUrl);

				this.logger.info(`Row ${itemIndex + 1}: Data validation passed, proceeding with API calls`);

				// 1. Create Campaign
				// Docs: https://learn.microsoft.com/en-us/advertising/campaign-management-service/addcampaigns
				const campaignResponse = await microsoftAdsApiRequest.call(
					this,
					'POST',
					ENDPOINTS.campaignCreate,
					{
						AccountId: accountId,
						Campaigns: [
							{
								Name: campaignName,
								BudgetType: 'DailyBudgetStandard',
								DailyBudget: budget,
								CampaignType: 'Search',
								TimeZone: 'IndiaStandardTime',
								Languages: ['English'],
								BiddingScheme: { Type: cpcStrategy },
								Status: 'Paused',
							},
						],
					},
					itemIndex,
				) as IDataObject;

				const campaignIds = campaignResponse.CampaignIds as string[];
				campaignId = campaignIds?.[0];
				if (!campaignId) {
					throw new NodeOperationError(this.getNode(), 'Failed to create campaign: No campaign ID returned', { itemIndex });
				}
				this.logger.info(`Campaign created: ${campaignId}`);

				// 1b. Add Location Targeting
				await microsoftAdsApiRequest.call(
					this,
					'POST',
					ENDPOINTS.campaignCriterion,
					{
						CampaignCriterions: [
							{
								CampaignId: campaignId,
								Criterion: {
									Type: 'LocationCriterion',
									LocationId: Number(location),
								},
								Type: 'BiddableCampaignCriterion',
								CriterionBid: {
									Type: 'BidMultiplier',
									Multiplier: 0,
								},
							},
						],
						CriterionType: 'Targets',
					},
					itemIndex,
				);
				this.logger.info(`Location targeting added: ${location}`);

				// 2. Create Ad Group
				// Docs: https://learn.microsoft.com/en-us/advertising/campaign-management-service/addadgroups
				// AdGroupType must be "SearchStandard" for RSA ads
				const adGroupResponse = await microsoftAdsApiRequest.call(
					this,
					'POST',
					ENDPOINTS.adGroupCreate,
					{
						CampaignId: campaignId,
						AdGroups: [
							{
								Name: adGroupName,
								Status: 'Active',
								AdGroupType: 'SearchStandard',
								CpcBid: { Amount: DEFAULT_CPC_BID },
							},
						],
					},
					itemIndex,
				) as IDataObject;

				const adGroupIds = adGroupResponse.AdGroupIds as string[];
				adGroupId = adGroupIds?.[0];
				if (!adGroupId) {
					throw new NodeOperationError(this.getNode(), 'Failed to create ad group: No ad group ID returned', { itemIndex });
				}
				this.logger.info(`Ad Group created: ${adGroupId}`);

				// 3. Create Responsive Search Ad
				// Docs: https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad
				const adResponse = await createResponsiveSearchAd(
					this,
					adGroupId,
					headlines,
					descriptions,
					finalUrl,
					path1,
					path2,
					itemIndex,
				);

				const adIds = adResponse.AdIds as string[];
				const adId = adIds?.[0];
				this.logger.info(`Responsive Search Ad created: ${adId}`);

				// 4. Create Keywords
				const createdKeywordIds: string[] = [];
				if (keywords && keywords.length > 0) {
					const keywordObjects = keywords.map((keywordText: string) => ({
						Text: keywordText,
						MatchType: matchType,
						Bid: { Amount: DEFAULT_CPC_BID },
						Status: 'Active',
					}));

					const keywordResponse = await microsoftAdsApiRequest.call(
						this,
						'POST',
						ENDPOINTS.keywordCreate,
						{ AdGroupId: adGroupId, Keywords: keywordObjects },
						itemIndex,
					) as IDataObject;

					const keywordIds = keywordResponse.KeywordIds as string[];
					if (keywordIds) {
						createdKeywordIds.push(...keywordIds.filter(Boolean));
					}
					this.logger.info(`Created ${createdKeywordIds.length} keywords.`);
				} else {
					this.logger.info('No keywords found to create.');
				}

				// Add successful result
				results.push({
					json: {
						row: itemIndex + 1,
						campaignName,
						adGroupName,
						budget,
						headlines,
						descriptions,
						finalUrl,
						path1,
						path2,
						keywords,
						campaignId,
						adGroupId,
						adId,
						createdKeywordIds,
						message: 'Campaign, Ad Group, Ad, and Keywords created successfully',
					},
					pairedItem: {
						item: itemIndex,
					},
				});

			} catch (error: unknown) {
				const err = error as Error & { errors?: Array<{ message?: string; error_code?: string }> };
				errorMessage = err.message;

				const campaignIdentifier = campaignName ? `Campaign "${campaignName}" (Row ${itemIndex + 1})` : `Row ${itemIndex + 1}`;
				this.logger.error(`Error creating Microsoft Ads ${campaignIdentifier}: ${errorMessage}`);

				// Attempt to clean up partially created resources
				if (campaignId) {
					try {
						await microsoftAdsApiRequest.call(
							this,
							'POST',
							ENDPOINTS.campaignDelete,
							{ AccountId: accountId, CampaignIds: [campaignId] },
							itemIndex,
						);
						this.logger.warn(`Deleted Campaign: ${campaignId} due to subsequent error.`);
					} catch (cleanupError: unknown) {
						this.logger.error(`Failed to delete Campaign ${campaignId} during cleanup: ${(cleanupError as Error).message}`);
					}
				}

				// Add error result but don't throw - continue processing other rows
				results.push({
					json: {
						row: itemIndex + 1,
						Processed: 'no',
						campaignName: campaignName || '',
						error: {
							message: errorMessage,
							details: error,
						},
					},
					pairedItem: {
						item: itemIndex,
					},
				});
			}
		}

		// Always return results, even if some rows failed
		const successfulCount = results.filter(r => !r.json.error).length;
		const failedCount = results.filter(r => r.json.error).length;
		this.logger.info(`Processed ${totalRows} rows. ${successfulCount} successful, ${failedCount} failed.`);
		return [results];
	}
}
