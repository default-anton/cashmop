import { expect, Locator, Page } from '@playwright/test';

export class AnalysisPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly analysisButton: Locator;
  readonly prevMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly currentMonthLabel: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Financial Analysis' });
    this.analysisButton = page.getByLabel('Navigate to Analysis', { exact: true });
    this.prevMonthButton = page.getByLabel('Previous Month', { exact: true });
    this.nextMonthButton = page.getByLabel('Next Month', { exact: true });
    this.currentMonthLabel = page.getByLabel('Current Month', { exact: true });
    this.deleteButton = this.page.getByRole('button', { name: /Delete \(\d+\)/ });
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

  getTransactionCheckbox(transactionDescription: string) {
    return this.page.locator('tr').filter({ hasText: transactionDescription }).locator('input[type="checkbox"]');
  }

  async selectTransaction(transactionDescription: string) {
    await this.getTransactionCheckbox(transactionDescription).check();
  }

  async deselectTransaction(transactionDescription: string) {
    await this.getTransactionCheckbox(transactionDescription).uncheck();
  }

  async expectTransactionSelected(transactionDescription: string) {
    await expect(this.getTransactionCheckbox(transactionDescription)).toBeChecked();
  }

  async expectTransactionNotSelected(transactionDescription: string) {
    await expect(this.getTransactionCheckbox(transactionDescription)).not.toBeChecked();
  }

  async clickDeleteButton() {
    await this.deleteButton.click();
  }

  async expectDeleteButtonVisible() {
    await expect(this.deleteButton).toBeVisible();
  }

  async expectDeleteButtonHidden() {
    await expect(this.deleteButton).not.toBeVisible();
  }

  async expectDeleteButtonWithCount(count: number) {
    await expect(this.page.getByRole('button', { name: `Delete (${count})`, exact: true })).toBeVisible();
  }

  async confirmDelete() {
    await this.page.getByRole('button', { name: 'Delete', exact: true }).click();
  }

  async cancelDelete() {
    await this.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }

  async expectTransactionVisible(transactionDescription: string) {
    await expect(this.page.locator('tr').filter({ hasText: transactionDescription })).toBeVisible();
  }

  async expectTransactionNotVisible(transactionDescription: string) {
    await expect(this.page.locator('tr').filter({ hasText: transactionDescription })).not.toBeVisible();
  }

  // Owner filter methods
  getOwnerFilterButton() {
    return this.page.locator('th').filter({ hasText: 'Owner' }).locator('button');
  }

  async openOwnerFilter() {
    await this.getOwnerFilterButton().click();
  }

  async expectOwnerFilterVisible() {
    await expect(this.page.getByText('Filter by Owner', { exact: true })).toBeVisible();
  }

  async selectOwnerInFilter(ownerName: string) {
    await this.page.locator('button').filter({ hasText: ownerName, exact: true }).click();
  }

  async clickSelectAllOwners() {
    await this.page.getByRole('button', { name: 'Select All', exact: true }).click();
  }

  async clickDeselectAllOwners() {
    await this.page.getByRole('button', { name: 'Deselect All', exact: true }).click();
  }

  async clickOnlyOwner(ownerName: string) {
    const ownerRow = this.page.locator('button').filter({ hasText: ownerName, exact: true }).locator('..');
    await ownerRow.locator('button', { hasText: 'ONLY' }).click();
  }

  async searchOwners(searchTerm: string) {
    await this.page.locator('input[placeholder="Search owners..."]').fill(searchTerm);
  }

  async clearOwnerFilter() {
    await this.page.getByRole('button', { name: 'Reset', exact: true }).click();
  }

  async closeOwnerFilter() {
    await this.page.keyboard.press('Escape');
  }
}
