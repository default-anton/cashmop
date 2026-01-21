import { test, expect } from './lib/fixtures';

test('should allow selecting and deleting single transaction', async ({ page, analysisPage }) => {
  await page.goto('/');
  await analysisPage.navigateTo();

  // Verify initial state - delete button should not be visible
  await analysisPage.expectDeleteButtonHidden();

  // Select a transaction
  await analysisPage.selectTransaction('Safeway');
  await analysisPage.expectTransactionSelected('Safeway');

  // Verify delete button appears with count
  await analysisPage.expectDeleteButtonWithCount(1);

  // Click delete button and confirm
  await analysisPage.clickDeleteButton();
  await analysisPage.confirmDelete();

  // Wait for delete to complete
  await page.waitForTimeout(500);

  // Verify transaction is deleted
  await analysisPage.expectTransactionNotVisible('Safeway');

  // Verify delete button is hidden again
  await analysisPage.expectDeleteButtonHidden();
});

test('should allow selecting and deleting multiple transactions', async ({ page, analysisPage }) => {
  await page.goto('/');
  await analysisPage.navigateTo();

  // Select multiple transactions
  await analysisPage.selectTransaction('Subway');
  await analysisPage.selectTransaction('Brooklyn Bagel');

  // Verify both are selected
  await analysisPage.expectTransactionSelected('Subway');
  await analysisPage.expectTransactionSelected('Brooklyn Bagel');

  // Verify delete button shows count
  await analysisPage.expectDeleteButtonWithCount(2);

  // Delete them
  await analysisPage.clickDeleteButton();
  await analysisPage.confirmDelete();

  // Wait for delete to complete
  await page.waitForTimeout(500);

  // Verify both transactions are deleted
  await analysisPage.expectTransactionNotVisible('Subway');
  await analysisPage.expectTransactionNotVisible('Brooklyn Bagel');
});

test('should cancel delete when dialog is dismissed', async ({ page, analysisPage }) => {
  await page.goto('/');
  await analysisPage.navigateTo();

  // Select a transaction
  await analysisPage.selectTransaction('Amazon.ca');
  await analysisPage.expectTransactionSelected('Amazon.ca');
  await analysisPage.expectDeleteButtonVisible();

  // Click delete but cancel the dialog
  await analysisPage.clickDeleteButton();
  await analysisPage.cancelDelete();

  // Verify transaction still exists
  await analysisPage.expectTransactionVisible('Amazon.ca');
  await analysisPage.expectTransactionSelected('Amazon.ca');

  // Verify delete button still visible
  await analysisPage.expectDeleteButtonVisible();
});

test('should allow deselecting transactions', async ({ page, analysisPage }) => {
  await page.goto('/');
  await analysisPage.navigateTo();

  // Select a transaction
  await analysisPage.selectTransaction('Amazon.ca');
  await analysisPage.expectTransactionSelected('Amazon.ca');
  await analysisPage.expectDeleteButtonVisible();

  // Deselect it
  await analysisPage.deselectTransaction('Amazon.ca');
  await analysisPage.expectTransactionNotSelected('Amazon.ca');

  // Verify delete button is hidden
  await analysisPage.expectDeleteButtonHidden();
});

test('should show correct transaction count in delete button', async ({ page, analysisPage }) => {
  await page.goto('/');
  await analysisPage.navigateTo();

  // Select transactions one by one and verify count
  await analysisPage.selectTransaction('Amazon.ca');
  await analysisPage.expectDeleteButtonWithCount(1);

  await analysisPage.selectTransaction('Netflix');
  await analysisPage.expectDeleteButtonWithCount(2);

  await analysisPage.selectTransaction('Starbucks');
  await analysisPage.expectDeleteButtonWithCount(3);

  // Deselect one and verify count updates
  await analysisPage.deselectTransaction('Netflix');
  await analysisPage.expectDeleteButtonWithCount(2);
});
