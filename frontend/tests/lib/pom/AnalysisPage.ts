import { expect, type Locator, type Page } from "@playwright/test";

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
    this.heading = page.getByRole("heading", { name: "Financial Analysis" });
    this.analysisButton = page.getByLabel("Navigate to Analysis", { exact: true });
    this.prevMonthButton = page.getByLabel("Previous Month", { exact: true });
    this.nextMonthButton = page.getByLabel("Next Month", { exact: true });
    this.currentMonthLabel = page.getByLabel("Current Month", { exact: true });
    this.deleteButton = this.page.getByRole("button", { name: /Delete \(\d+\)/ });
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
    return this.page.locator("tr").filter({ hasText: transactionDescription }).locator('input[type="checkbox"]');
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
    await expect(this.page.getByRole("button", { name: `Delete (${count})`, exact: true })).toBeVisible();
  }

  async confirmDelete() {
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
  }

  async cancelDelete() {
    await this.page.getByRole("button", { name: "Cancel", exact: true }).click();
  }

  async expectTransactionVisible(transactionDescription: string) {
    await expect(this.page.locator("tr").filter({ hasText: transactionDescription })).toBeVisible();
  }

  async expectTransactionNotVisible(transactionDescription: string) {
    await expect(this.page.locator("tr").filter({ hasText: transactionDescription })).not.toBeVisible();
  }

  private getFilterPopover(title: string) {
    return this.page
      .locator("div")
      .filter({ has: this.page.getByText(title, { exact: true }) })
      .first();
  }

  // Month filter methods
  getMonthFilterButton() {
    return this.page.getByLabel("Month filter", { exact: true });
  }

  async openMonthFilter() {
    await this.getMonthFilterButton().click();
    await expect(this.page.getByText("Filter by Month", { exact: true })).toBeVisible();
  }

  async selectMonth(monthLabel: string) {
    await this.openMonthFilter();
    const popover = this.getFilterPopover("Filter by Month");
    await popover.getByRole("button", { name: monthLabel, exact: true }).click();
  }

  // Category filter methods
  getCategoryFilterButton() {
    return this.page.getByLabel("Category filter", { exact: true });
  }

  async openCategoryFilter() {
    await this.getCategoryFilterButton().click();
    await expect(this.page.getByText("Filter by Category", { exact: true })).toBeVisible();
  }

  async expectCategoryOptionVisible(name: string) {
    const popover = this.getFilterPopover("Filter by Category");
    await expect(popover.getByRole("button", { name, exact: true })).toBeVisible();
  }

  async expectCategoryOptionHidden(name: string) {
    const popover = this.getFilterPopover("Filter by Category");
    await expect(popover.getByRole("button", { name, exact: true })).toHaveCount(0);
  }

  // Owner filter methods
  getOwnerFilterButton() {
    return this.page.getByLabel("Owner filter", { exact: true });
  }

  async openOwnerFilter() {
    await this.getOwnerFilterButton().click();
    await this.expectOwnerFilterVisible();
  }

  async expectOwnerFilterVisible() {
    await expect(this.page.getByText("Filter by Owner", { exact: true })).toBeVisible();
  }

  async expectOwnerOptionVisible(name: string) {
    const popover = this.getFilterPopover("Filter by Owner");
    await expect(popover.getByRole("button", { name, exact: true })).toBeVisible();
  }

  async expectOwnerOptionHidden(name: string) {
    const popover = this.getFilterPopover("Filter by Owner");
    await expect(popover.getByRole("button", { name, exact: true })).toHaveCount(0);
  }

  async selectOwnerInFilter(ownerName: string) {
    const popover = this.getFilterPopover("Filter by Owner");
    await popover.getByRole("button", { name: ownerName, exact: true }).click();
  }

  async clickSelectAllOwners() {
    const popover = this.getFilterPopover("Filter by Owner");
    await popover.getByRole("button", { name: "Select All", exact: true }).click();
  }

  async clickDeselectAllOwners() {
    const popover = this.getFilterPopover("Filter by Owner");
    await popover.getByRole("button", { name: "Deselect All", exact: true }).click();
  }

  async clickOnlyOwner(ownerName: string) {
    const popover = this.getFilterPopover("Filter by Owner");
    const ownerButton = popover.getByRole("button", { name: ownerName, exact: true });
    await ownerButton.hover();
    const ownerRow = ownerButton.locator("..");
    await ownerRow.getByRole("button", { name: "ONLY", exact: true }).click();
  }

  async searchOwners(searchTerm: string) {
    const popover = this.getFilterPopover("Filter by Owner");
    await popover.getByLabel("Search owners", { exact: true }).fill(searchTerm);
  }

  async clearOwnerFilter() {
    const popover = this.getFilterPopover("Filter by Owner");
    await popover.getByRole("button", { name: "Reset", exact: true }).click();
  }

  async closeOwnerFilter() {
    await this.page.keyboard.press("Escape");
  }
}
