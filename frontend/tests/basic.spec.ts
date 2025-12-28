import { test } from './lib/fixtures';

test('should show uncategorized transactions and allow categorization', async ({ categorizationPage, analysisPage }) => {
  await categorizationPage.goto();

  // Wait for the app to load and show the transaction
  await categorizationPage.expectTransaction('Amazon.ca');

  // Categorize
  await categorizationPage.categorize('Shopping');

  // After categorization, it should navigate to Analysis screen
  await analysisPage.expectVisible();
});

test('should show analysis screen when no uncategorized transactions', async ({ categorizationPage, analysisPage }) => {
  await categorizationPage.goto();
  await analysisPage.expectAnalysisButtonVisible();
});
