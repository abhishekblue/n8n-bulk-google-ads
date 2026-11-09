/**
 * Test script for Microsoft Ads REST API endpoints
 *
 * Usage:
 *   node test-microsoft-ads.js
 *
 * Before running, set these environment variables:
 *   MSADS_ACCESS_TOKEN    - OAuth2 access token
 *   MSADS_DEVELOPER_TOKEN - Developer token
 *   MSADS_CUSTOMER_ID     - Customer ID
 *   MSADS_ACCOUNT_ID      - Account ID
 *
 * Or edit the values below directly.
 */

const ACCESS_TOKEN = process.env.MSADS_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN_HERE';
const DEVELOPER_TOKEN = process.env.MSADS_DEVELOPER_TOKEN || 'YOUR_DEVELOPER_TOKEN_HERE';
const CUSTOMER_ID = process.env.MSADS_CUSTOMER_ID || '159871137';
const ACCOUNT_ID = process.env.MSADS_ACCOUNT_ID || '140175939';

const BASE_URL = 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13';

async function apiCall(endpoint, body) {
	const url = `${BASE_URL}${endpoint}`;
	console.log(`\n>>> POST ${url}`);
	console.log('Body:', JSON.stringify(body, null, 2));

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${ACCESS_TOKEN}`,
			'DeveloperToken': DEVELOPER_TOKEN,
			'CustomerId': CUSTOMER_ID,
			'CustomerAccountId': ACCOUNT_ID,
		},
		body: JSON.stringify(body),
	});

	const data = await response.json();
	console.log(`\n<<< Response (${response.status}):`);
	console.log(JSON.stringify(data, null, 2));

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
	}

	if (data.PartialErrors && data.PartialErrors.length > 0) {
		console.log('\n⚠️  Partial Errors:', JSON.stringify(data.PartialErrors, null, 2));
	}

	return data;
}

async function testAll() {
	console.log('=== Microsoft Ads API Test ===\n');

	// Step 1: Create Campaign
	console.log('\n--- STEP 1: Create Campaign ---');
	const campaignResult = await apiCall('/Campaigns', {
		AccountId: ACCOUNT_ID,
		Campaigns: [{
			Name: 'Test Campaign ' + Date.now(),
			BudgetType: 'DailyBudgetStandard',
			DailyBudget: 50,
			CampaignType: 'Search',
			TimeZone: 'IndiaStandardTime',
			Languages: { string: ['English'] },
			Status: 'Paused',
		}],
	});
	const campaignId = campaignResult.CampaignIds?.[0];
	console.log(`\n✅ Campaign ID: ${campaignId}`);

	if (!campaignId) {
		console.log('❌ Campaign creation failed, stopping.');
		return;
	}

	// Step 2: Create Ad Group
	console.log('\n--- STEP 2: Create Ad Group ---');
	const adGroupResult = await apiCall('/AdGroups', {
		CampaignId: campaignId,
		AdGroups: [{
			Name: 'Test Ad Group',
			Status: 'Active',
			AdGroupType: 'SearchStandard',
			CpcBid: { Amount: 1.00 },
		}],
	});
	const adGroupId = adGroupResult.AdGroupIds?.[0];
	console.log(`\n✅ Ad Group ID: ${adGroupId}`);

	if (!adGroupId) {
		console.log('❌ Ad Group creation failed, stopping.');
		return;
	}

	// Step 3: Create Responsive Search Ad
	console.log('\n--- STEP 3: Create Responsive Search Ad ---');
	const adResult = await apiCall('/Ads', {
		AdGroupId: adGroupId,
		Ads: [{
			Type: 'ResponsiveSearch',
			Headlines: [
				{ Asset: { Type: 'TextAsset', Text: 'Test Headline One' } },
				{ Asset: { Type: 'TextAsset', Text: 'Test Headline Two' } },
				{ Asset: { Type: 'TextAsset', Text: 'Test Headline Three' } },
			],
			Descriptions: [
				{ Asset: { Type: 'TextAsset', Text: 'Test description line one for ads' } },
				{ Asset: { Type: 'TextAsset', Text: 'Test description line two for ads' } },
			],
			FinalUrls: ['https://www.example.com'],
			Path1: 'test',
			Path2: 'ads',
			Status: 'Active',
		}],
	});
	const adId = adResult.AdIds?.[0];
	console.log(`\n✅ Ad ID: ${adId}`);

	// Step 4: Create Keywords
	console.log('\n--- STEP 4: Create Keywords ---');
	const keywordResult = await apiCall('/Keywords', {
		AdGroupId: adGroupId,
		Keywords: [
			{ Text: 'test keyword one', MatchType: 'Exact', Bid: { Amount: 1.00 }, Status: 'Active' },
			{ Text: 'test keyword two', MatchType: 'Broad', Bid: { Amount: 0.50 }, Status: 'Active' },
		],
	});
	const keywordIds = keywordResult.KeywordIds;
	console.log(`\n✅ Keyword IDs: ${JSON.stringify(keywordIds)}`);

	// Summary
	console.log('\n\n=== SUMMARY ===');
	console.log(`Campaign ID:  ${campaignId}`);
	console.log(`Ad Group ID:  ${adGroupId}`);
	console.log(`Ad ID:        ${adId}`);
	console.log(`Keyword IDs:  ${JSON.stringify(keywordIds)}`);
	console.log('\nAll endpoints working! ✅');
}

testAll().catch(err => {
	console.error('\n❌ Test failed:', err.message);
});
