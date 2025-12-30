import { expect, Locator, Page } from '@playwright/test';

export class CategorizationPage {
  readonly page: Page;
  readonly categoryInput: Locator;
  readonly categorizeButton: Locator;
  readonly searchWebButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryInput = page.getByLabel('Category', { exact: true });
    this.categorizeButton = page.getByTestId('categorize-submit-button');
    this.searchWebButton = page.getByRole('button', { name: /search web for context/i });
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectTransaction(description: string) {
    await expect(this.page.getByLabel('Transaction Description', { exact: true })).toHaveText(description, { timeout: 10000 });
  }

  async categorize(categoryName: string) {
    await this.categoryInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.categoryInput.fill(categoryName);
    await this.categorizeButton.click();
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
}
