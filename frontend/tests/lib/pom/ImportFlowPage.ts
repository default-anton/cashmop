import { expect, type Locator, type Page } from "@playwright/test";

export class ImportFlowPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly nextButton: Locator;
  readonly startImportButton: Locator;
  readonly accountInput: Locator;
  readonly mappingTable: Locator;
  readonly headerToggle: Locator;
  readonly autoMappingBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.fileInput = page.locator('input[type="file"]');
    this.nextButton = page.getByRole("button", { name: /Next|Continue/ });
    this.startImportButton = page.getByRole("button", { name: "Start Import" });
    this.accountInput = page.getByPlaceholder("e.g. RBC Checking");
    this.mappingTable = page.getByTestId("mapping-table");
    this.headerToggle = page.getByTestId("header-row-toggle");
    this.autoMappingBanner = page.getByTestId("auto-mapping-banner");
  }

  async goto() {
    await this.page.goto("/");
    const importNav = this.page.getByLabel("Navigate to Import", { exact: true });
    await importNav.waitFor({ state: "visible", timeout: 10000 });
    await this.page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
    });
    await this.page.getByText("Import Transactions", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
    await this.fileInput.waitFor({ state: "attached", timeout: 10000 });
  }

  async uploadFile(path: string) {
    await this.fileInput.setInputFiles(path);
  }

  async uploadFiles(paths: string[]) {
    await this.fileInput.setInputFiles(paths);
  }

  async ensureHeaderRow(hasHeader: boolean) {
    await this.headerToggle.waitFor({ state: "visible", timeout: 10000 });
    const target = hasHeader ? "Yes" : "No";
    await this.headerToggle.getByRole("button", { name: target, exact: true }).click();
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

  async mapColumn(headerName: string) {
    try {
      await this.mappingTable.waitFor({ state: "visible", timeout: 10000 });
    } catch (_err) {
      const parseError = this.page.locator("text=No files could be parsed. Check errors above.");
      const fileErrors = this.page.locator("text=File Errors");
      const errorChunks: string[] = [];
      if (await parseError.isVisible().catch(() => false)) {
        errorChunks.push("parse error banner visible");
      }
      if (await fileErrors.isVisible().catch(() => false)) {
        errorChunks.push("file errors visible");
      }
      throw new Error(`Mapping table not visible. ${errorChunks.join(" ")}`);
    }
    try {
      await this.mappingTable.getByRole("columnheader").first().waitFor({ state: "visible", timeout: 10000 });
    } catch {
      const headerCount = await this.mappingTable.getByRole("columnheader").count();
      const tableText = (await this.mappingTable.textContent())?.trim() || "";
      throw new Error(`Mapping headers missing. count=${headerCount} text=${tableText.slice(0, 80)}`);
    }

    const tryClickHeader = async (name: string, timeout = 200) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const header = this.mappingTable.getByRole("columnheader", { name: new RegExp(escaped, "i") });
      try {
        await header.first().waitFor({ state: "visible", timeout });
        await header.first().click();
        return true;
      } catch {
        return false;
      }
    };

    if (await tryClickHeader(headerName, 200)) return;

    const fallback = this.getFallbackHeader(headerName);
    if (fallback && (await tryClickHeader(fallback, 1000))) return;

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

    const headers = await this.mappingTable.getByRole("columnheader").allTextContents();
    throw new Error(
      `Unable to map column: ${headerName}. Available headers: ${headers
        .map((h) => h.trim())
        .filter(Boolean)
        .join(", ")}`,
    );
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

  async expectAutoMappingDetected() {
    await expect(this.autoMappingBanner).toBeVisible({ timeout: 10000 });
  }

  async expectAutoMappingNotDetected() {
    await expect(this.autoMappingBanner).toHaveCount(0);
  }

  async expectCanContinueWithoutRemapping() {
    await expect(this.nextButton).toBeEnabled({ timeout: 10000 });
  }

  async waitForMonthSelector() {
    await this.page
      .getByRole("heading", { name: "Select Range", exact: true })
      .waitFor({ state: "visible", timeout: 10000 });
  }

  async completeMonthSelection() {
    await this.waitForMonthSelector();
    const btn = this.page.getByRole("button", { name: /Map Next File|Start Import/ });
    await expect(btn).toBeEnabled({ timeout: 10000 });
    await btn.click();
  }

  monthOptionButton(label: string) {
    return this.page.locator("button", { hasText: label });
  }

  async startImport() {
    await expect(this.startImportButton).toBeEnabled();
    await this.startImportButton.click();
  }

  async expectComplete() {
    // The app may immediately transition to the Categorize screen after import.
    // We check for both the success message and the target screen header.
    const complete = this.page.getByText("Import Complete!", { exact: true });
    const inbox = this.page.getByText("Review Inbox", { exact: true });
    await expect(complete.or(inbox)).toBeVisible({ timeout: 5000 });
  }
}
