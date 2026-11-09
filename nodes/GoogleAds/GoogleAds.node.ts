import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import { GoogleAdsApi, enums, Customer } from 'google-ads-api';
import { IGoogleAdsApiCredentials } from '../../credentials/GoogleAdsApi.credentials';
import { mapColumnData } from './utils/columnMapper';
import { DEFAULT_BUDGET_MICROS, DEFAULT_LOCATION_ID } from './utils/defaults';
import { validateAdData } from './utils/dataValidator';
import { createResponsiveSearchAd } from './utils/adCreator';

// Helper function to normalize column names for robust comparison
function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class GoogleAds implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Google Ads for L4M',
    name: 'googleAds',
    group: ['transform'],
    version: 1,
    description: 'Create Google Ads campaigns and ad groups',
    defaults: {
      name: 'Google Ads',
    },
    inputs: ['main', 'main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'googleAdsApi',
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
      console.log('Input 0 Column Names:', Object.keys(firstInput0Item));
      console.log('Input 1 Column Names:', Object.keys(firstInput1Item));
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

    console.log(`DEBUG: Processing ${sidItems.length} sidItems and ${sonuItems.length} sonuItems`);
    console.log(`DEBUG: totalRows to process: ${totalRows}`);

    for (let itemIndex = 0; itemIndex < totalRows; itemIndex++) {
      console.log(`DEBUG: Starting row ${itemIndex + 1} of ${totalRows}`);
      console.log(`DEBUG: sidItems[${itemIndex}]:`, JSON.stringify(sidItems[itemIndex]?.json, null, 2));
      console.log(`DEBUG: sonuItems[${itemIndex}]:`, JSON.stringify(sonuItems[itemIndex]?.json, null, 2));
      console.log(`DEBUG: Processing row ${itemIndex + 1} of ${totalRows}`);

      let campaignBudgetResourceName: string | null | undefined;
      let campaignResourceName: string | null | undefined;
      let adGroupResourceName: string | null | undefined;
      let customer: Customer | undefined;
      let campaignName: string | undefined;
      let errorMessage = '';

      try {
        const mergedInputData = {
          ...sidItems[itemIndex].json,
          ...sonuItems[itemIndex].json,
        };

        // Use columnMapper to extract data from sheets
        const mappedData = mapColumnData(mergedInputData);

        // Use defaults for missing values and extract data
        campaignName = (mappedData.campaignName as string) || 'New Campaign';
        const adGroupName: string = (mappedData.adGroupName as string) || 'New Ad Group';
        const budget: number = mappedData.budget !== undefined ? Number(mappedData.budget) : DEFAULT_BUDGET_MICROS;
        const headlines: string[] = mappedData.headlines && Array.isArray(mappedData.headlines) ? mappedData.headlines as string[] : [];
        const descriptions: string[] = mappedData.descriptions && Array.isArray(mappedData.descriptions) ? mappedData.descriptions as string[] : [];
        const finalUrl: string = (mappedData.finalUrl as string) || 'http://www.example.com';
        const path1: string | undefined = mappedData.path1 !== undefined ? String(mappedData.path1) : undefined;
        const path2: string | undefined = mappedData.path2 !== undefined ? String(mappedData.path2) : undefined;
        const keywords: string[] = mappedData.keywords && Array.isArray(mappedData.keywords) ? mappedData.keywords as string[] : [];
        const location: string = (mappedData.location as string) || DEFAULT_LOCATION_ID;

        // Validate data before API calls
        validateAdData(campaignName, adGroupName, budget, headlines, descriptions, finalUrl);

        console.log(`Row ${itemIndex + 1}: Data validation passed, proceeding with API calls`);
        console.log('Mapped data:', JSON.stringify(mappedData, null, 2));

        const credentials = await this.getCredentials('googleAdsApi') as IGoogleAdsApiCredentials;

        const client = new GoogleAdsApi({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          developer_token: credentials.developerToken,
        });

        customer = client.Customer({
          customer_id: credentials.customerId,
          refresh_token: credentials.refreshToken
        });

        // 1. Create Campaign Budget
        const budgetResource = await customer.campaignBudgets.create([
          {
            amount_micros: budget,
            delivery_method: 'STANDARD',
            explicitly_shared: false,
          },
        ]);
        campaignBudgetResourceName = budgetResource.results[0].resource_name;
        this.logger.info(`Campaign Budget created: ${campaignBudgetResourceName}`);

        // 2. Create Campaign
        const campaignResource = await customer.campaigns.create([
          {
            name: campaignName,
            status: 'PAUSED', // Start paused for safety
            campaign_budget: campaignBudgetResourceName,
            advertising_channel_type: 'SEARCH',
            network_settings: {
              target_google_search: true,
              target_search_network: false,
              target_content_network: false,
              target_partner_search_network: false,
            },
            contains_eu_political_advertising: enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
						target_spend: {
							cpc_bid_ceiling_micros: 3000000, // Maximum CPC of 3 units
						},
          },
        ]);
        campaignResourceName = campaignResource.results[0].resource_name;
        this.logger.info(`Campaign created: ${campaignResourceName}`);

        // Add location targeting to campaign
        await customer.campaignCriteria.create([{
          campaign: campaignResourceName,
          location: {
            geo_target_constant: `geoTargetConstants/${location}`
          }
        } as any]);
        console.log('Location targeting added to campaign:', campaignResourceName);

        // 3. Create Ad Group
        const adGroupResource = await customer.adGroups.create([
          {
            name: adGroupName,
            campaign: campaignResourceName,
            status: 'ENABLED',
            type: 'SEARCH_STANDARD',
            cpc_bid_micros: 1000000,
          },
        ]);
        adGroupResourceName = adGroupResource.results[0].resource_name;
        this.logger.info(`Ad Group created: ${adGroupResourceName}`);

        // 4. Create Responsive Search Ad
        let adResourceName: string | undefined;
        if (!adGroupResourceName) {
          throw new NodeOperationError(
            this.getNode(),
            'Failed to create ad group: No resource name returned',
            { itemIndex }
          );
        }

        adResourceName = await createResponsiveSearchAd(
          customer,
          adGroupResourceName,
          headlines,
          descriptions,
          finalUrl,
          path1,
          path2,
        );

        this.logger.info(`Responsive Search Ad created: ${adResourceName}`);

        // 5. Create Keywords
        const createdKeywordResourceNames: string[] = [];
        if (keywords && keywords.length > 0) {
          const adGroupCriteria = keywords.map((keywordText: string) => ({
            ad_group: adGroupResourceName,
            keyword: {
              text: keywordText,
              match_type: enums.KeywordMatchType.EXACT,
            },
          }));

          const keywordResource = await customer.adGroupCriteria.create(adGroupCriteria);

          keywordResource.results.forEach((result: { resource_name?: string | null }) => {
            if (result.resource_name) {
              createdKeywordResourceNames.push(result.resource_name);
            }
          });

          this.logger.info(`Created ${createdKeywordResourceNames.length} keywords.`);
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
            campaignResourceName,
            budgetResourceName: campaignBudgetResourceName,
            adGroupResourceName,
            adResourceName,
            createdKeywordResourceNames,
            message: 'Campaign, Ad Group, Ad, and Keywords created successfully',
          },
          pairedItem: {
            item: itemIndex,
          },
        });

      } catch (error: any) {
        console.log(`Row ${itemIndex + 1} ERROR:`, error.message);

        errorMessage = error.message;
        let policyViolationDetails: string[] = [];

        if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
          error.errors.forEach((err: any) => {
            if (err.message) {
              errorMessage = err.message;
            }
            if (err.error_code) {
              errorMessage += ` (Code: ${JSON.stringify(err.error_code)})`;
            }
            if (err.policy_violation_details) {
              policyViolationDetails.push(
                `Policy Violation: ${err.policy_violation_details.policy_text_key} - ${err.policy_violation_details.violating_text_field}`
              );
            }
          });
        }

        if (policyViolationDetails.length > 0) {
          errorMessage += `\nPolicy Violations:\n${policyViolationDetails.join('\n')}`;
        }

        const campaignIdentifier = campaignName ? `Campaign "${campaignName}" (Row ${itemIndex + 1})` : `Row ${itemIndex + 1}`;
        this.logger.error(`Error creating Google Ads ${campaignIdentifier}: ${errorMessage}`);

        // Attempt to clean up partially created resources
        if (customer) {
          if (adGroupResourceName) {
            try {
              await customer.adGroups.update([
                {
                  resource_name: adGroupResourceName,
                  status: 'REMOVED',
                },
              ]);
              this.logger.warn(`Deleted Ad Group: ${adGroupResourceName} due to subsequent error.`);
            } catch (cleanupError: any) {
              this.logger.error(`Failed to delete Ad Group ${adGroupResourceName} during cleanup: ${cleanupError.message}`);
            }
          }
          if (campaignResourceName) {
            try {
              await customer.campaigns.update([
                {
                  resource_name: campaignResourceName,
                  status: 'REMOVED',
                },
              ]);
              this.logger.warn(`Deleted Campaign: ${campaignResourceName} due to subsequent error.`);
            } catch (cleanupError: any) {
              this.logger.error(`Failed to delete Campaign ${campaignResourceName} during cleanup: ${cleanupError.message}`);
            }
          }
          if (campaignBudgetResourceName) {
            try {
              await customer.campaignBudgets.update([
                {
                  resource_name: campaignBudgetResourceName,
                  status: 'REMOVED',
                },
              ]);
              this.logger.warn(`Deleted Campaign Budget: ${campaignBudgetResourceName} due to subsequent error.`);
            } catch (cleanupError: any) {
              this.logger.error(`Failed to delete Campaign Budget ${campaignBudgetResourceName} during cleanup: ${cleanupError.message}`);
            }
          }
        }

        // Add error result but don't throw - continue processing other rows
        results.push({
          json: {
            row: itemIndex + 1,
            Processed: 'no', // For Excel updater - mark as not processed due to error
            campaignName: campaignName || '',
            error: {
              message: errorMessage,
              stack: error.stack,
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
