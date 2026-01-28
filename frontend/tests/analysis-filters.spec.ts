import { test } from './lib/fixtures';

// Verifies that Analysis filter dropdowns only show options present in the selected month.
// Also validates that synthetic options (Uncategorized / No Owner) only appear when relevant.

test('analysis filters are scoped to the selected month', async ({ categorizationPage, analysisPage }) => {
  await categorizationPage.goto();
  await analysisPage.navigateTo();

  // Default month should be the most recent one from fixtures: Oct 2023.
  await analysisPage.openCategoryFilter();
  await analysisPage.expectCategoryOptionVisible('Groceries');
  await analysisPage.expectCategoryOptionVisible('Dining Out');
  await analysisPage.expectCategoryOptionVisible('Income');
  await analysisPage.expectCategoryOptionVisible('Transport');
  await analysisPage.expectCategoryOptionVisible('Uncategorized');
  await analysisPage.expectCategoryOptionHidden('Unused Category');

  await analysisPage.openOwnerFilter();
  await analysisPage.expectOwnerFilterVisible();
  await analysisPage.expectOwnerOptionVisible('Me');
  await analysisPage.expectOwnerOptionVisible('Partner');
  await analysisPage.expectOwnerOptionVisible('No Owner');
  await analysisPage.expectOwnerOptionHidden('Friend');

  // Switch to Sep 2023 (fixtures contain only categorized + owned transactions in Sep).
  const sepLabel = await analysisPage.page.evaluate(() => (
    new Date(2023, 8).toLocaleDateString('default', { month: 'short', year: 'numeric' })
  ));
  await analysisPage.selectMonth(sepLabel);

  await analysisPage.openCategoryFilter();
  await analysisPage.expectCategoryOptionVisible('Groceries');
  await analysisPage.expectCategoryOptionVisible('Dining Out');
  await analysisPage.expectCategoryOptionVisible('Income');
  await analysisPage.expectCategoryOptionHidden('Transport');
  await analysisPage.expectCategoryOptionHidden('Uncategorized');
  await analysisPage.expectCategoryOptionHidden('Unused Category');

  await analysisPage.openOwnerFilter();
  await analysisPage.expectOwnerFilterVisible();
  await analysisPage.expectOwnerOptionVisible('Me');
  await analysisPage.expectOwnerOptionVisible('Partner');
  await analysisPage.expectOwnerOptionHidden('No Owner');
  await analysisPage.expectOwnerOptionHidden('Friend');
});
