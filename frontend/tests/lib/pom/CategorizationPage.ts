import { expect, Locator, Page } from '@playwright/test';

export class CategorizationPage {
  readonly page: Page;
  readonly categoryInput: Locator;
  readonly categorizeButton: Locator;
  readonly searchWebButton: Locator;
  readonly skipButton: Locator;
  readonly undoToast: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly dismissButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryInput = page.getByLabel('Category', { exact: true });
    this.categorizeButton = page.getByTestId('categorize-submit-button');
    this.searchWebButton = page.getByRole('button', { name: /search web for context/i });
    this.skipButton = page.getByRole('button', { name: /skip/i });
    this.undoToast = this.page.getByTestId('undo-toast');
    this.undoButton = this.undoToast.getByRole('button', { name: 'Undo' });
    this.redoButton = this.undoToast.getByRole('button', { name: 'Redo' });
    this.dismissButton = this.undoToast.getByLabel('Dismiss');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.getByLabel('Navigate to Categories', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });

    if (await this.categoryInput.isVisible()) {
      return;
    }

    const waitForTransactions = async () => {
      await this.page.waitForFunction(async () => {
        const app = (window as any).go?.main?.App;
        if (!app?.GetUncategorizedTransactions) return false;
        try {
          const txs = await app.GetUncategorizedTransactions();
          return Array.isArray(txs) && txs.length > 0;
        } catch {
          return false;
        }
      }, null, { timeout: 10000 });
    };

    try {
      await waitForTransactions();
    } catch {
      const inboxZero = this.page.getByText('Inbox Zero!', { exact: true });
      if (await inboxZero.isVisible()) {
        await this.page.getByRole('button', { name: 'Refresh' }).click();
      }
      await waitForTransactions();
    }

    const categorizeNav = this.page.getByLabel('Navigate to Categorize', { exact: true });
    try {
      await categorizeNav.waitFor({ state: 'visible', timeout: 5000 });
      await categorizeNav.click();
      await this.categoryInput.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      // fall through
    }
  }

  async expectTransaction(description: string) {
    await expect(this.page.getByLabel('Transaction Description', { exact: true })).toHaveText(description, { timeout: 10000 });
  }

  async categorize(categoryName: string) {
    await this.categoryInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.categoryInput.fill(categoryName);
    await this.categorizeButton.click();
    // Wait a bit for async operations to complete
    await this.page.waitForTimeout(100);
  }

  async skip() {
    await this.skipButton.click();
  }

  async triggerWebSearch() {
    await this.searchWebButton.click();
  }

  async expectWebSearchResults() {
    await expect(this.page.getByText(/web search context/i)).toBeVisible({ timeout: 15000 });
  }

  async expectWebSearchLoading() {
    await expect(this.page.getByText(/searching web\.\.\./i)).toBeVisible({ timeout: 5000 });
  }

  async expectWebSearchResult(title: string) {
    await expect(this.page.getByRole('link', { name: title })).toBeVisible({ timeout: 15000 });
  }

  async expectUndoToast(message?: string) {
    await expect(this.undoToast).toBeVisible({ timeout: 5000 });
    if (message) {
      await expect(this.undoToast.getByText(new RegExp(message, 'i'))).toBeVisible();
    }
  }

  async expectNoUndoToast() {
    await expect(this.undoToast).not.toBeVisible();
  }

  async clickUndo() {
    await this.undoButton.click();
  }

  async dismissUndo() {
    await this.dismissButton.click();
  }
}
