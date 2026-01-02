import { test, expect } from './lib/fixtures';

test.describe('Undo/Redo Categorization', () => {
  test('should show undo toast after single categorization', async ({ categorizationPage }) => {
    await categorizationPage.goto();

    // Categorize the transaction
    await categorizationPage.categorize('Shopping');

    // Expect undo toast to appear with Undo button
    await categorizationPage.expectUndoToast();
    await expect(categorizationPage.undoButton).toBeVisible();
    await expect(categorizationPage.redoButton).not.toBeVisible();

    // Dismiss the toast
    await categorizationPage.dismissUndo();
    await categorizationPage.expectNoUndoToast();
  });

  test('should support undo for single categorization', async ({ categorizationPage }) => {
    await categorizationPage.goto();

    // Get current transaction description
    const descriptionLocator = categorizationPage.page.getByLabel('Transaction Description', { exact: true });
    await descriptionLocator.waitFor({ state: 'visible', timeout: 10000 });
    const transactionDesc = await descriptionLocator.textContent();

    // Categorize the transaction
    await categorizationPage.categorize('Shopping');

    // Verify undo toast appeared
    await categorizationPage.expectUndoToast();

    // Click undo
    await categorizationPage.clickUndo();

    // Verify we're back at the same transaction
    await categorizationPage.expectTransaction(transactionDesc || '');

    // Verify the category input is empty (transaction is uncategorized again)
    const categoryInput = categorizationPage.page.getByLabel('Category', { exact: true });
    await expect(categoryInput).toHaveValue('');

    // Toast should show Redo button
    await expect(categorizationPage.redoButton).toBeVisible();
  });

  test('should show undo toast after skip', async ({ categorizationPage }) => {
    await categorizationPage.goto();

    // Skip the transaction
    await categorizationPage.skip();

    // Expect undo toast to appear
    await categorizationPage.expectUndoToast();
    await expect(categorizationPage.undoButton).toBeVisible();
    await expect(categorizationPage.redoButton).not.toBeVisible();
  });

  test('should support undo for skip', async ({ categorizationPage }) => {
    await categorizationPage.goto();

    // Get current transaction description
    const descriptionLocator = categorizationPage.page.getByLabel('Transaction Description', { exact: true });
    await descriptionLocator.waitFor({ state: 'visible', timeout: 10000 });
    const transactionDesc = await descriptionLocator.textContent();

    // Skip the transaction
    await categorizationPage.skip();

    // Click undo
    await categorizationPage.clickUndo();

    // Verify we're back at the skipped transaction
    await categorizationPage.expectTransaction(transactionDesc || '');

    // Toast should show Redo button
    await expect(categorizationPage.redoButton).toBeVisible();
  });

  test('should show undo toast for rule-based categorization', async ({ categorizationPage }) => {
    await categorizationPage.goto();

    // Get current transaction description
    const descriptionLocator = categorizationPage.page.getByLabel('Transaction Description', { exact: true });
    await descriptionLocator.waitFor({ state: 'visible', timeout: 10000 });

    // Select text to trigger rule mode
    await descriptionLocator.selectText();

    // Categorize with text selection (creates a rule)
    await categorizationPage.categorize('Shopping');

    // Verify undo toast appeared with rule message
    await categorizationPage.expectUndoToast();
    await expect(categorizationPage.undoButton).toBeVisible();
    await expect(categorizationPage.redoButton).not.toBeVisible();
  });

  test('should support undo for rule-based categorization', async ({ categorizationPage }) => {
    await categorizationPage.goto();

    // Get current transaction description
    const descriptionLocator = categorizationPage.page.getByLabel('Transaction Description', { exact: true });
    await descriptionLocator.waitFor({ state: 'visible', timeout: 10000 });
    const transactionDesc = await descriptionLocator.textContent();

    // Select text to trigger rule mode
    await descriptionLocator.selectText();

    // Categorize with text selection (creates a rule)
    await categorizationPage.categorize('Shopping');

    // Click undo
    await categorizationPage.clickUndo();

    // Verify we're back at the original transaction
    await categorizationPage.expectTransaction(transactionDesc || '');

    // Toast should show Redo button
    await expect(categorizationPage.redoButton).toBeVisible();
  });

  test('should clear redo stack on new action', async ({ categorizationPage }) => {
    await categorizationPage.goto();

    // Categorize first transaction
    await categorizationPage.categorize('Shopping');
    await categorizationPage.expectUndoToast();

    // Undo to populate redo stack
    await categorizationPage.clickUndo();
    await expect(categorizationPage.redoButton).toBeVisible();

    // Categorize again (should clear redo stack)
    await categorizationPage.categorize('Dining');

    // Redo button should be gone
    await expect(categorizationPage.redoButton).not.toBeVisible();
  });

  test('undo toast should auto-dismiss after 5 seconds', async ({ categorizationPage }) => {
    await categorizationPage.goto();

    // Categorize the transaction
    await categorizationPage.categorize('Shopping');

    // Verify undo toast appeared
    await categorizationPage.expectUndoToast();

    // Wait for auto-dismiss (5 seconds)
    await categorizationPage.page.waitForTimeout(5500);

    // Verify toast is gone
    await categorizationPage.expectNoUndoToast();
  });
});
