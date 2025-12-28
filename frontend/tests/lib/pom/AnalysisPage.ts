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
    this.analysisButton = page.locator('button:has-text("Analysis")');
    this.prevMonthButton = page.locator('button:has(.lucide-chevron-left)');
    this.nextMonthButton = page.locator('button:has(.lucide-chevron-right)');
    this.currentMonthLabel = page.locator('.lucide-calendar + span');
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
