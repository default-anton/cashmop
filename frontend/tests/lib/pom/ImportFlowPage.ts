import { expect, Locator, Page } from '@playwright/test';

export class ImportFlowPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly nextButton: Locator;
  readonly startImportButton: Locator;
  readonly accountInput: Locator;
  readonly mappingTable: Locator;
  readonly headerToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.fileInput = page.locator('input[type="file"]');
    this.nextButton = page.getByRole('button', { name: /Next|Continue/ });
    this.startImportButton = page.getByRole('button', { name: 'Start Import' });
    this.accountInput = page.getByPlaceholder('e.g. RBC Checking');
    this.mappingTable = page.getByTestId('mapping-table');
    this.headerToggle = page.getByTestId('header-row-toggle');
  }

  async goto() {
    await this.page.goto('/');
    const importNav = this.page.getByLabel('Navigate to Import', { exact: true });
    await importNav.waitFor({ state: 'visible', timeout: 10000 });
    const inbox = this.page.getByText('Review Inbox', { exact: true });
    try {
      await inbox.waitFor({ state: 'visible', timeout: 5000 });
    } catch {}
    await this.page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    });
    await this.page.getByText('Import Transactions', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    await this.fileInput.waitFor({ state: 'attached', timeout: 10000 });
  }

  async uploadFile(path: string) {
    await this.fileInput.setInputFiles(path);
    await this.page.getByText(/file selected/i).waitFor({ state: 'visible', timeout: 10000 });
  }

  async ensureHeaderRow(hasHeader: boolean) {
    await this.headerToggle.waitFor({ state: 'visible', timeout: 10000 });
    const target = hasHeader ? 'Yes' : 'No';
    await this.headerToggle.getByRole('button', { name: target, exact: true }).click();
  }

  getFallbackHeader(headerName: string) {
    const map: Record<string, string> = {
      Date: 'Column A',
      Amount: 'Column C',
      Description: 'Column B',
      Currency: 'Column D',
    };
    return map[headerName];
  }

  async mapColumn(headerName: string) {
    try {
      await this.mappingTable.waitFor({ state: 'visible', timeout: 10000 });
    } catch (err) {
      const parseError = this.page.locator('text=No files could be parsed. Check errors above.');
      const fileErrors = this.page.locator('text=File Errors');
      const errorChunks: string[] = [];
      if (await parseError.isVisible().catch(() => false)) {
        errorChunks.push('parse error banner visible');
      }
      if (await fileErrors.isVisible().catch(() => false)) {
        errorChunks.push('file errors visible');
      }
      throw new Error(`Mapping table not visible. ${errorChunks.join(' ')}`);
    }
    try {
      await this.mappingTable.getByRole('columnheader').first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      const headerCount = await this.mappingTable.getByRole('columnheader').count();
      const tableText = (await this.mappingTable.textContent())?.trim() || '';
      throw new Error(`Mapping headers missing. count=${headerCount} text=${tableText.slice(0, 80)}`);
    }

    const tryClickHeader = async (name: string) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const header = this.mappingTable.getByRole('columnheader', { name: new RegExp(escaped, 'i') });
      try {
        await header.first().waitFor({ state: 'visible', timeout: 2000 });
        await header.first().click();
        return true;
      } catch {
        return false;
      }
    };

    if (await tryClickHeader(headerName)) return;

    const fallback = this.getFallbackHeader(headerName);
    if (fallback && await tryClickHeader(fallback)) return;

    let toggleVisible = false;
    try {
      toggleVisible = await this.headerToggle.isVisible();
    } catch {
      toggleVisible = false;
    }

    if (toggleVisible) {
      await this.ensureHeaderRow(true);
      if (await tryClickHeader(headerName)) return;
    }

    const headers = await this.mappingTable.getByRole('columnheader').allTextContents();
    throw new Error(`Unable to map column: ${headerName}. Available headers: ${headers.map((h) => h.trim()).filter(Boolean).join(', ')}`);
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
