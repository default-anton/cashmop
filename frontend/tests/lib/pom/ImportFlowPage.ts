import { expect, Locator, Page } from '@playwright/test';

export class ImportFlowPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly nextButton: Locator;
  readonly startImportButton: Locator;
  readonly accountInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.fileInput = page.locator('input[type="file"]');
    this.nextButton = page.getByRole('button', { name: /Next|Continue/ });
    this.startImportButton = page.getByRole('button', { name: 'Start Import' });
    this.accountInput = page.getByPlaceholder('e.g. RBC Checking');
  }

  async goto() {
    await this.page.goto('/');
    const importNav = this.page.getByLabel('Navigate to Import', { exact: true });
    if (await importNav.isVisible()) {
      await importNav.click();
    }
  }

  async uploadFile(path: string) {
    await this.fileInput.setInputFiles(path);
  }

  async mapColumn(headerName: string) {
    await this.page.locator('th').getByText(headerName, { exact: true }).click();
  }

  async mapDate(headerName: string) {
    await this.mapColumn(headerName);
    await this.nextStep();
  }

  async mapAmount(headerName: string) {
    await this.mapColumn(headerName);
    await this.nextStep();
  }

  async mapDescription(headerName: string) {
    await this.mapColumn(headerName);
    await this.nextStep();
  }

  async setAccountStatic(name: string) {
    await this.accountInput.fill(name);
    await this.nextStep();
  }

  async nextStep() {
    await this.nextButton.click();
  }

  async startImport() {
    await expect(this.startImportButton).toBeEnabled();
    await this.startImportButton.click();
  }

  async expectComplete() {
    await expect(this.page.getByText('Import Complete!', { exact: true })).toBeVisible({ timeout: 10000 });
  }
}
