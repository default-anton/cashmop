import { expect, Locator, Page } from '@playwright/test';

export class CategorizationPage {
  readonly page: Page;
  readonly categoryInput: Locator;
  readonly categorizeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryInput = page.getByPlaceholder('Type a category...');
    this.categorizeButton = page.getByLabel('Categorize');
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectTransaction(description: string) {
    await expect(this.page.locator(`text=${description}`)).toBeVisible({ timeout: 10000 });
  }

  async categorize(categoryName: string) {
    await this.categoryInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.categoryInput.fill(categoryName);
    await this.categorizeButton.click();
  }
}
