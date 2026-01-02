import { test } from './lib/fixtures';

test('should show uncategorized transactions and allow categorization', async ({ categorizationPage, analysisPage }) => {
  await categorizationPage.goto();

  // Wait for the app to load and show a transaction
  const descriptionLocator = categorizationPage.page.getByLabel('Transaction Description', { exact: true });
  await descriptionLocator.waitFor({ state: 'visible', timeout: 10000 });

  // Categorize
  await categorizationPage.categorize('Shopping');

  // After categorization, it should navigate to next transaction (or Analysis if done)
  // Since we have multiple uncategorized transactions, we should see another one
  await descriptionLocator.waitFor({ state: 'visible', timeout: 10000 });
});

test('should show analysis screen when no uncategorized transactions', async ({ categorizationPage, analysisPage }) => {
  await categorizationPage.goto();
  await analysisPage.expectAnalysisButtonVisible();
});

test('should perform web search for transaction context', async ({ categorizationPage }) => {
  await categorizationPage.goto();

  // Wait for a transaction to load
  const descriptionLocator = categorizationPage.page.getByLabel('Transaction Description', { exact: true });
  await descriptionLocator.waitFor({ state: 'visible', timeout: 10000 });

  // Trigger web search
  await categorizationPage.triggerWebSearch();

  // Expect loading state
  await categorizationPage.expectWebSearchLoading();

  // Expect web search results to appear
  await categorizationPage.expectWebSearchResults();
});
