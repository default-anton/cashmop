import { expect, type Locator, type Page } from "@playwright/test";

export class SettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly settingsButton: Locator;
  readonly lastBackupLabel: Locator;
  readonly refreshButton: Locator;
  readonly createBackupButton: Locator;
  readonly openBackupFolderButton: Locator;
  readonly selectBackupFileButton: Locator;
  readonly restoreBackupButton: Locator;
  readonly cancelRestoreButton: Locator;
  readonly backupDetailsSection: Locator;
  readonly transactionCountLabel: Locator;
  readonly backupSizeLabel: Locator;
  readonly backupDateLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Settings" });
    this.settingsButton = page.getByLabel("Navigate to Settings", { exact: true });
    this.lastBackupLabel = page.getByTestId("settings-last-auto-backup-value");
    this.refreshButton = page.getByRole("button", { name: /Refresh/i });
    this.createBackupButton = page.getByRole("button", { name: /Create Backup/i });
    this.openBackupFolderButton = page.getByRole("button", { name: /Open Backup Folder/i });
    this.selectBackupFileButton = page.getByRole("button", { name: /Select Backup File/i });
    this.restoreBackupButton = page.getByRole("button", { name: /Restore Backup/i });
    this.cancelRestoreButton = page.getByRole("button", { name: /Cancel/i });
    this.backupDetailsSection = page.getByText(/Backup Details/i);
    this.transactionCountLabel = page.getByText(/Transactions:/);
    this.backupSizeLabel = page.getByText(/Size:/);
    this.backupDateLabel = page.getByText(/Created:/);
  }

  async expectVisible() {
    await expect(this.heading).toBeVisible({ timeout: 15000 });
  }

  async navigateTo() {
    await this.settingsButton.waitFor({ state: "visible", timeout: 15000 });
    await this.settingsButton.click();
    await this.expectVisible();
  }

  async expectSettingsButtonVisible() {
    await expect(this.settingsButton).toBeVisible();
  }

  async expectLastBackupVisible() {
    await expect(this.lastBackupLabel).toBeVisible({ timeout: 15000 });
  }

  async expectLastBackupToBe(text: string) {
    await expect(this.lastBackupLabel).toHaveText(text);
  }

  async clickRefresh() {
    await this.refreshButton.click();
  }

  async clickCreateBackup() {
    await this.createBackupButton.click();
  }

  async clickOpenBackupFolder() {
    await this.openBackupFolderButton.click();
  }

  async clickSelectBackupFile() {
    await this.selectBackupFileButton.click();
  }

  async clickRestoreBackup() {
    await this.restoreBackupButton.click();
  }

  async clickCancelRestore() {
    await this.cancelRestoreButton.click();
  }

  async expectBackupDetailsVisible() {
    await expect(this.backupDetailsSection).toBeVisible();
  }

  async expectBackupDetailsHidden() {
    await expect(this.backupDetailsSection).not.toBeVisible();
  }

  async expectTransactionCount(count: string) {
    await expect(this.page.getByText(`Transactions: ${count}`)).toBeVisible();
  }
}
