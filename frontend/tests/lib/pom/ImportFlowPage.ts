import { expect, type Locator, type Page } from "@playwright/test";

export class ImportFlowPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly importButton: Locator;
  readonly accountInput: Locator;
  readonly ownerInput: Locator;
  readonly mappingTable: Locator;
  readonly autoMappingBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.fileInput = page.locator('input[type="file"]');
    this.importButton = page.getByLabel("Import data", { exact: true });
    this.accountInput = page.getByLabel("Account", { exact: true });
    this.ownerInput = page.getByLabel("Owner", { exact: true });
    this.mappingTable = page.getByTestId("mapping-table");
    this.autoMappingBanner = page.getByTestId("auto-mapping-banner");
  }

  async goto() {
    await this.page.goto("/");

    const importNav = this.page.getByLabel("Navigate to Import", { exact: true });
    await importNav.waitFor({ state: "visible", timeout: 10000 });
    await importNav.click();

    await this.page.getByText("Import Transactions", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
    await this.fileInput.waitFor({ state: "attached", timeout: 15000 });
  }

  async uploadFile(path: string) {
    await this.fileInput.setInputFiles(path);
  }

  async uploadFiles(paths: string[]) {
    await this.fileInput.setInputFiles(paths);
  }

  getFallbackHeader(headerName: string) {
    const map: Record<string, string> = {
      Date: "Column A",
      Amount: "Column C",
      Description: "Column B",
      Currency: "Column D",
    };
    return map[headerName];
  }

  async mapColumnRole(headerName: string, roleLabel: string) {
    await this.mappingTable.waitFor({ state: "visible", timeout: 10000 });

    const trySelect = async (name: string) => {
      const cell = this.mappingTable.locator(`th[data-column-header="${name}"]`).first();
      if ((await cell.count()) === 0) return false;

      await cell.waitFor({ state: "visible", timeout: 2000 });

      const trigger = cell.getByTestId("column-role-trigger").first();
      if ((await trigger.count()) === 0) return false;

      await trigger.click();

      const optionsMenu = this.page.locator('[data-testid="column-role-options"]:visible').last();
      await optionsMenu.waitFor({ state: "visible", timeout: 2000 });

      const option = optionsMenu.getByRole("button", { name: roleLabel, exact: true }).first();
      if ((await option.count()) === 0) {
        await this.page.keyboard.press("Escape");
        return false;
      }

      await option.scrollIntoViewIfNeeded();
      await option.click({ force: true });
      return true;
    };

    if (await trySelect(headerName)) return;

    const fallback = this.getFallbackHeader(headerName);
    if (fallback && (await trySelect(fallback))) return;

    const headers = await this.mappingTable
      .locator("th[data-column-header]")
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.columnHeader || ""));

    throw new Error(
      `Unable to map column: ${headerName}. Available headers: ${headers
        .map((h) => h.trim())
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  async mapDate(headerName: string) {
    await this.mapColumnRole(headerName, "Date");
  }

  async mapAmount(headerName: string) {
    await this.mapColumnRole(headerName, "Money (signed)");
  }

  async mapDescription(headerName: string) {
    await this.mapColumnRole(headerName, "Description");
  }

  async mapCurrency(headerName: string) {
    await this.mapColumnRole(headerName, "Currency");
  }

  async unmapColumn(headerName: string) {
    await this.mappingTable.waitFor({ state: "visible", timeout: 10000 });

    const tryUnmap = async (name: string) => {
      const cell = this.mappingTable.locator(`th[data-column-header="${name}"]`).first();
      if ((await cell.count()) === 0) return false;

      const clearButton = cell.getByLabel(`Unmap ${name} column`, { exact: true }).first();
      if ((await clearButton.count()) === 0) return false;

      await clearButton.click();
      return true;
    };

    if (await tryUnmap(headerName)) return;

    const fallback = this.getFallbackHeader(headerName);
    if (fallback && (await tryUnmap(fallback))) return;

    throw new Error(`Unable to unmap column: ${headerName}`);
  }

  async expectColumnRoleLabel(headerName: string, roleLabel: string) {
    await this.mappingTable.waitFor({ state: "visible", timeout: 10000 });

    const assertLabel = async (name: string) => {
      const cell = this.mappingTable.locator(`th[data-column-header="${name}"]`).first();
      if ((await cell.count()) === 0) return false;

      const trigger = cell.getByTestId("column-role-trigger").first();
      if ((await trigger.count()) === 0) return false;

      await expect(trigger).toContainText(roleLabel, { timeout: 3000 });
      return true;
    };

    if (await assertLabel(headerName)) return;

    const fallback = this.getFallbackHeader(headerName);
    if (fallback && (await assertLabel(fallback))) return;

    throw new Error(`Unable to assert role label for column: ${headerName}`);
  }

  async setAccountStatic(name: string) {
    await this.accountInput.fill(name);
  }

  async setOwnerStatic(name: string) {
    await this.ownerInput.fill(name);
  }

  async expectAutoMappingDetected() {
    await expect(this.autoMappingBanner).toBeVisible({ timeout: 10000 });
  }

  async expectAutoMappingNotDetected() {
    await expect(this.autoMappingBanner).toHaveCount(0);
  }

  async expectCanImport() {
    await expect(this.importButton).toBeEnabled({ timeout: 10000 });
  }

  async expectCannotImport() {
    await expect(this.importButton).toBeDisabled({ timeout: 10000 });
  }

  async startImport() {
    await expect(this.importButton).toBeEnabled();
    await this.importButton.click();
  }

  async expectComplete() {
    const complete = this.page.getByText("Import Complete!", { exact: true });
    const inbox = this.page.getByText("Review Inbox", { exact: true });
    await expect(complete.or(inbox)).toBeVisible({ timeout: 5000 });
  }
}
