import { test, expect } from './lib/fixtures';

test('should show missing rate warning and placeholder amounts', async ({ page, analysisPage }) => {
  await page.goto('/');
  await analysisPage.navigateTo();

  const jpyRow = page.locator('tr', { hasText: 'Tokyo Taxi' });
  await expect(jpyRow).toBeVisible();
  await expect(page.getByText('Exchange rates missing', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(jpyRow.getByText('—', { exact: true })).toBeVisible();
});

test('should show original currency when enabled in settings', async ({ page, settingsPage, analysisPage }) => {
  await page.goto('/');
  await settingsPage.navigateTo();

  const showOriginalToggle = page.getByRole('checkbox', { name: 'Show original transaction currency' });
  await showOriginalToggle.check();

  await analysisPage.navigateTo();
  const usdRow = page.locator('tr', { hasText: 'Brooklyn Bagel' });
  await expect(usdRow.getByText('USD 20.00', { exact: true })).toBeVisible();
});
