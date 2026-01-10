import { test, expect } from './lib/fixtures';

test('should successfully import transactions from sample data', async ({ page, settingsPage, categorizationPage }) => {
  await page.goto('/');
  await settingsPage.navigateTo();
  const showOriginalToggle = page.getByRole('checkbox', { name: 'Show original transaction currency' });
  await showOriginalToggle.check();

  const txs = [
    {
      date: '2023-10-01',
      description: 'Groceries',
      amount: -50,
      category: '',
      account: 'Checking',
      owner: 'Unassigned',
      currency: 'USD',
    },
    {
      date: '2023-10-02',
      description: 'Salary',
      amount: 3000,
      category: '',
      account: 'Checking',
      owner: 'Unassigned',
      currency: 'USD',
    },
  ];

  await page.evaluate(async (data) => {
    await (window as any).go.main.App.ImportTransactions(data);
  }, txs);

  await categorizationPage.goto();

  // 4. Done / Verify Import
  // App.tsx might auto-navigate to categorization if uncategorized transactions exist.
  // We want to see one of our imported transactions in the loop.
  
  const expectedDescriptions = ['Groceries', 'Salary'];
  let found = false;

  // Try to find one of our imported transactions in the first few items of the loop
  for (let i = 0; i < 5; i++) {
    const descLocator = page.getByLabel('Transaction Description', { exact: true });
    await descLocator.waitFor({ state: 'visible', timeout: 10000 });
    const text = await descLocator.innerText();
    
    if (expectedDescriptions.includes(text)) {
      if (text === 'Groceries') {
        await expect(page.getByText('USD 50.00', { exact: true })).toBeVisible();
      }
      if (text === 'Salary') {
        await expect(page.getByText('USD 3000.00', { exact: true })).toBeVisible();
      }
      found = true;
      break;
    }
    
    // Categorize whatever is there to move to the next one
    await categorizationPage.categorize('Shopping');
  }

  expect(found).toBe(true);
});
