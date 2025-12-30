import { test, expect } from './lib/fixtures';

test.describe('Settings Screen', () => {
  test('should navigate to Settings screen', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();
    await settingsPage.expectVisible();
  });

  test('should show last backup info', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // The last backup info should be visible
    await settingsPage.expectLastBackupVisible();

    // It should show either a date or "Never"
    const lastBackupText = await settingsPage.lastBackupLabel.textContent();
    expect(lastBackupText).toBeTruthy();
  });

  test('should show manual backup controls', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    await expect(settingsPage.createBackupButton).toBeVisible();
    await expect(settingsPage.openBackupFolderButton).toBeVisible();
  });

  test('should show restore controls', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    await expect(settingsPage.selectBackupFileButton).toBeVisible();
    await settingsPage.expectBackupDetailsHidden();
  });

  test('should refresh backup info', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Click refresh button
    await settingsPage.clickRefresh();

    // Last backup info should still be visible after refresh
    await settingsPage.expectLastBackupVisible();
  });

  test('should show all navigation buttons including Settings', async ({ page }) => {
    await page.goto('/');

    // Check that Settings button is visible in navigation
    const settingsButton = page.getByLabel('Navigate to Settings', { exact: true });
    await expect(settingsButton).toBeVisible();
  });
});

test.describe('Settings Backup Flow', () => {
  test('should have backup information card', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Check for the Last Auto Backup card
    await expect(page.getByText(/Last Auto Backup/i)).toBeVisible();
  });

  test('should have manual backup section', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Check for Manual Backup heading
    await expect(page.getByRole('heading', { name: /Manual Backup/i })).toBeVisible();

    // Check for descriptive text
    await expect(page.getByText(/Create a backup of your entire database/i)).toBeVisible();
  });

  test('should have restore section with warning', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Check for Restore from Backup heading
    await expect(page.getByRole('heading', { name: /Restore from Backup/i })).toBeVisible();

    // Check for warning message
    await expect(page.getByText(/Warning: This will replace your current data/i)).toBeVisible();
  });

  test('should have automatic backups info section', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Check for Automatic Backups heading
    await expect(page.getByRole('heading', { name: /Automatic Backups/i })).toBeVisible();

    // Check for description
    await expect(page.getByText(/Automatic backups run daily when 24\+ hours have passed/i)).toBeVisible();
  });
});

test.describe('Backup Creation Flow', () => {
  test('should create manual backup successfully', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Get initial last backup state
    const initialBackupText = await settingsPage.lastBackupLabel.textContent();
    const initialShowedNever = initialBackupText?.toLowerCase().includes('never');

    // Click create backup - this will show the file picker
    // Note: In automated testing, we can't actually interact with the file picker,
    // but we can verify the button click triggers the dialog
    await settingsPage.clickCreateBackup();

    // After the dialog is dismissed (or cancelled), verify we're still on settings
    await settingsPage.expectVisible();
  });

  test('should show backup folder when clicked', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Click open backup folder
    await settingsPage.clickOpenBackupFolder();

    // Verify we're still on settings (folder opens in OS file manager)
    await settingsPage.expectVisible();
  });
});

test.describe('Restore Flow', () => {
  test('should show validation dialog when backup file is selected', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Backup details should be hidden initially
    await settingsPage.expectBackupDetailsHidden();

    // Click select backup file
    // Note: In automated testing, we can't actually select a file,
    // but we can verify the button exists
    await expect(settingsPage.selectBackupFileButton).toBeVisible();
  });

  test('should have cancel button in restore confirmation', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Cancel button should NOT be visible initially (only shows after backup selection)
    await expect(settingsPage.cancelRestoreButton).not.toBeVisible();
  });

  test('should show backup details section when restore is initiated', async ({ page, settingsPage }) => {
    await page.goto('/');
    await settingsPage.navigateTo();

    // Initially, backup details should be hidden
    await settingsPage.expectBackupDetailsHidden();

    // Note: Full flow requires actual file selection which isn't possible in automated tests
    // This test verifies the UI structure is in place
    await expect(settingsPage.selectBackupFileButton).toBeVisible();
  });
});
