import { test, expect } from './lib/fixtures';
import type { Page } from '@playwright/test';
import type { ImportFlowPage } from './lib/pom/ImportFlowPage';
import { fileURLToPath } from 'url';

const headerCsvPath = fileURLToPath(new URL('./fixtures/import_header_multi_currency.csv', import.meta.url));
const noHeaderCsvPath = fileURLToPath(new URL('./fixtures/import_no_header.csv', import.meta.url));

type ImportFlowConfig = {
  filePath: string;
  hasHeader: boolean;
  mapCurrency: boolean;
  accountName: string;
};

const runImportFlow = async (importFlowPage: ImportFlowPage, config: ImportFlowConfig) => {
  await importFlowPage.goto();
  await importFlowPage.page.evaluate(async () => {
    const app = (window as any).go.main.App;
    const mappings = await app.GetColumnMappings();
    await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
  });
  await importFlowPage.uploadFile(config.filePath);
  if (!config.hasHeader) {
    await importFlowPage.ensureHeaderRow(false);
  }
  await importFlowPage.mapDate('Date');
  await importFlowPage.mapAmount('Amount');
  await importFlowPage.mapDescription('Description');
  await importFlowPage.setAccountStatic(config.accountName);
  await importFlowPage.nextStep();
  if (config.mapCurrency) {
    await importFlowPage.mapColumn('Currency');
  }
  await importFlowPage.nextStep();
  await importFlowPage.startImport();
  await importFlowPage.expectComplete();
};

const fetchImportedTransactions = async (page: Page, descriptions: string[]) =>
  page.evaluate(async (target) => {
    const txs = await (window as any).go.main.App.GetUncategorizedTransactions();
    return txs
      .filter((tx: any) => target.includes(tx.description))
      .map((tx: any) => ({
        description: tx.description,
        currency: tx.currency,
        amount: tx.amount,
      }));
  }, descriptions);


test('should successfully import transactions from sample data', async ({ page }) => {
  await page.goto('/');

  const txs = [
    {
      date: '2023-10-01',
      description: 'Groceries',
      amount: -5000,
      category: '',
      account: 'Checking',
      owner: 'Unassigned',
      currency: 'USD',
    },
    {
      date: '2023-10-02',
      description: 'Salary',
      amount: 300000,
      category: '',
      account: 'Checking',
      owner: 'Unassigned',
      currency: 'USD',
    },
  ];

  await page.evaluate(async (data) => {
    await (window as any).go.main.App.ImportTransactions(data);
  }, txs);

  const expectedDescriptions = ['Groceries', 'Salary'];
  const imported = await fetchImportedTransactions(page, expectedDescriptions);
  expect(imported).toHaveLength(2);

  const byDescription = new Map(imported.map((tx) => [tx.description, tx]));

  const groceries = byDescription.get('Groceries');
  expect(groceries?.currency).toBe('USD');
  expect(groceries?.amount).toBe(-5000);

  const salary = byDescription.get('Salary');
  expect(salary?.currency).toBe('USD');
  expect(salary?.amount).toBe(300000);
});

test('import flow with header maps CAD + USD currencies', async ({ page, importFlowPage }) => {
  const descriptions = ['Import CAD Coffee', 'Import USD Lunch'];

  await runImportFlow(importFlowPage, {
    filePath: headerCsvPath,
    hasHeader: true,
    mapCurrency: true,
    accountName: 'Checking',
  });

  const imported = await fetchImportedTransactions(page, descriptions);
  expect(imported).toHaveLength(2);

  const byDescription = new Map(imported.map((tx) => [tx.description, tx]));

  const cadTx = byDescription.get('Import CAD Coffee');
  expect(cadTx?.currency).toBe('CAD');
  expect(cadTx?.amount).toBe(-450);

  const usdTx = byDescription.get('Import USD Lunch');
  expect(usdTx?.currency).toBe('USD');
  expect(usdTx?.amount).toBe(-1250);
});

test('import flow supports csv without header row', async ({ page, importFlowPage }) => {
  const descriptions = ['Import No Header One', 'Import No Header Two'];

  await runImportFlow(importFlowPage, {
    filePath: noHeaderCsvPath,
    hasHeader: false,
    mapCurrency: false,
    accountName: 'Checking',
  });

  const imported = await fetchImportedTransactions(page, descriptions);
  expect(imported).toHaveLength(2);

  const byDescription = new Map(imported.map((tx) => [tx.description, tx]));

  const first = byDescription.get('Import No Header One');
  expect(first?.currency).toBe('CAD');
  expect(first?.amount).toBe(-1525);

  const second = byDescription.get('Import No Header Two');
  expect(second?.currency).toBe('CAD');
  expect(second?.amount).toBe(12000);
});
