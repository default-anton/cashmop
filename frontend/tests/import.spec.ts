import { test, expect } from './lib/fixtures';

test('should successfully import transactions from a CSV file', async ({ importFlowPage, categorizationPage }) => {
  await importFlowPage.goto();

  // 1. Choose file
  const csvPath = 'tests/fixtures/sample_import.csv';
  await importFlowPage.uploadFile(csvPath);

  // 2. Map columns (Date, Amount, Description, Account)
  await importFlowPage.mapDate('Date');
  await importFlowPage.mapAmount('Amount');
  await importFlowPage.mapDescription('Description');
  await importFlowPage.setAccountStatic('Checking');

  // Skip optional steps (Owner, Currency)
  await importFlowPage.nextStep(); // Owner
  await importFlowPage.nextStep(); // Currency

  // 3. Month Selector
  await importFlowPage.startImport();

  // 4. Done / Verify Import
  // App.tsx might auto-navigate to categorization if uncategorized transactions exist.
  // We want to see one of our imported transactions in the loop.
  
  const expectedDescriptions = ['Groceries', 'Salary'];
  let found = false;

  // Try to find one of our imported transactions in the first few items of the loop
  for (let i = 0; i < 5; i++) {
    const descLocator = importFlowPage.page.getByLabel('Transaction Description', { exact: true });
    await descLocator.waitFor({ state: 'visible', timeout: 10000 });
    const text = await descLocator.innerText();
    
    if (expectedDescriptions.includes(text)) {
      found = true;
      break;
    }
    
    // Categorize whatever is there to move to the next one
    await categorizationPage.categorize('Shopping');
  }

  expect(found).toBe(true);
});
