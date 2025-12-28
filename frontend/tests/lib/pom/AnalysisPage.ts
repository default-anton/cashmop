import { expect, Locator, Page } from '@playwright/test';

export class AnalysisPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly analysisButton: Locator;
  readonly prevMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly currentMonthLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Financial Analysis' });
    this.analysisButton = page.getByLabel('Navigate to Analysis', { exact: true });
    this.prevMonthButton = page.getByLabel('Previous Month', { exact: true });
    this.nextMonthButton = page.getByLabel('Next Month', { exact: true });
    this.currentMonthLabel = page.getByLabel('Current Month', { exact: true });
  }

  async expectVisible() {
    await expect(this.heading).toBeVisible({ timeout: 15000 });
  }

  async navigateTo() {
    await this.analysisButton.click();
    await this.expectVisible();
  }

  async expectAnalysisButtonVisible() {
    await expect(this.analysisButton).toBeVisible();
  }

  async selectPreviousMonth() {
    await this.prevMonthButton.click();
  }

  async selectNextMonth() {
    await this.nextMonthButton.click();
  }

  async expectMonth(monthLabel: string) {
    await expect(this.currentMonthLabel).toHaveText(monthLabel);
  }
}
