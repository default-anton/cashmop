import type { Page } from "@playwright/test";
import { fileURLToPath } from "url";
import { expect, test } from "./lib/fixtures";
import type { ImportFlowPage } from "./lib/pom/ImportFlowPage";

const headerCsvPath = fileURLToPath(new URL("./fixtures/import_header_multi_currency.csv", import.meta.url));
const headerCsvCopyPath = fileURLToPath(new URL("./fixtures/import_header_multi_currency_copy.csv", import.meta.url));
const headerCsvExtraColumnPath = fileURLToPath(
  new URL("./fixtures/import_header_multi_currency_extra_column.csv", import.meta.url),
);
const headerCsvDuplicateHeadersPath = fileURLToPath(
  new URL("./fixtures/import_header_multi_currency_duplicate_headers.csv", import.meta.url),
);
const noHeaderCsvPath = fileURLToPath(new URL("./fixtures/import_no_header.csv", import.meta.url));

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
  await importFlowPage.mapDate("Date");
  await importFlowPage.mapAmount("Amount");
  await importFlowPage.mapDescription("Description");
  await importFlowPage.setAccountStatic(config.accountName);
  await importFlowPage.nextStep();
  if (config.mapCurrency) {
    await importFlowPage.mapColumn("Currency");
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
        owner: tx.owner_name || "",
      }));
  }, descriptions);

test("should successfully import transactions from sample data", async ({ page }) => {
  await page.goto("/");

  const txs = [
    {
      date: "2023-10-01",
      description: "Groceries",
      amount: -5000,
      category: "",
      account: "Checking",
      owner: "Unassigned",
      currency: "USD",
    },
    {
      date: "2023-10-02",
      description: "Salary",
      amount: 300000,
      category: "",
      account: "Checking",
      owner: "Unassigned",
      currency: "USD",
    },
  ];

  await page.evaluate(async (data) => {
    await (window as any).go.main.App.ImportTransactions(data);
  }, txs);

  const expectedDescriptions = ["Groceries", "Salary"];
  const imported = await fetchImportedTransactions(page, expectedDescriptions);
  expect(imported).toHaveLength(2);

  const byDescription = new Map(imported.map((tx) => [tx.description, tx]));

  const groceries = byDescription.get("Groceries");
  expect(groceries?.currency).toBe("USD");
  expect(groceries?.amount).toBe(-5000);

  const salary = byDescription.get("Salary");
  expect(salary?.currency).toBe("USD");
  expect(salary?.amount).toBe(300000);
});

test("import flow with header maps CAD + USD currencies", async ({ page, importFlowPage }) => {
  const descriptions = ["Import CAD Coffee", "Import USD Lunch"];

  await runImportFlow(importFlowPage, {
    filePath: headerCsvPath,
    hasHeader: true,
    mapCurrency: true,
    accountName: "Checking",
  });

  const imported = await fetchImportedTransactions(page, descriptions);
  expect(imported).toHaveLength(2);

  const byDescription = new Map(imported.map((tx) => [tx.description, tx]));

  const cadTx = byDescription.get("Import CAD Coffee");
  expect(cadTx?.currency).toBe("CAD");
  expect(cadTx?.amount).toBe(-450);

  const usdTx = byDescription.get("Import USD Lunch");
  expect(usdTx?.currency).toBe("USD");
  expect(usdTx?.amount).toBe(-1250);
});

test("import flow supports csv without header row", async ({ page, importFlowPage }) => {
  const descriptions = ["Import No Header One", "Import No Header Two"];

  await runImportFlow(importFlowPage, {
    filePath: noHeaderCsvPath,
    hasHeader: false,
    mapCurrency: false,
    accountName: "Checking",
  });

  const imported = await fetchImportedTransactions(page, descriptions);
  expect(imported).toHaveLength(2);

  const byDescription = new Map(imported.map((tx) => [tx.description, tx]));

  const first = byDescription.get("Import No Header One");
  expect(first?.currency).toBe("CAD");
  expect(first?.amount).toBe(-1525);

  const second = byDescription.get("Import No Header Two");
  expect(second?.currency).toBe("CAD");
  expect(second?.amount).toBe(12000);
});

test("import flow sets owner correctly", async ({ page, importFlowPage }) => {
  const descriptions = ["Import CAD Coffee", "Import USD Lunch"];

  await importFlowPage.goto();
  await page.evaluate(async () => {
    const app = (window as any).go.main.App;
    const mappings = await app.GetColumnMappings();
    await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
  });

  await importFlowPage.uploadFile(headerCsvPath);
  await importFlowPage.mapDate("Date");
  await importFlowPage.mapAmount("Amount");
  await importFlowPage.mapDescription("Description");
  await importFlowPage.setAccountStatic("Checking");
  // Owner step: set a custom owner
  await importFlowPage.setOwnerStatic("Alex");
  await importFlowPage.mapColumn("Currency");
  await importFlowPage.nextStep();
  await importFlowPage.startImport();
  await importFlowPage.expectComplete();

  const imported = await fetchImportedTransactions(page, descriptions);
  expect(imported).toHaveLength(2);

  for (const tx of imported) {
    expect(tx.owner).toBe("Alex");
  }
});

test("import flow defaults to Unassigned when no owner specified", async ({ page, importFlowPage }) => {
  const descriptions = ["Import CAD Coffee", "Import USD Lunch"];

  await importFlowPage.goto();
  await page.evaluate(async () => {
    const app = (window as any).go.main.App;
    const mappings = await app.GetColumnMappings();
    await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
  });

  await importFlowPage.uploadFile(headerCsvPath);
  await importFlowPage.mapDate("Date");
  await importFlowPage.mapAmount("Amount");
  await importFlowPage.mapDescription("Description");
  await importFlowPage.setAccountStatic("Checking");
  // Skip owner step (no owner specified)
  await importFlowPage.nextStep();
  await importFlowPage.mapColumn("Currency");
  await importFlowPage.nextStep();
  await importFlowPage.startImport();
  await importFlowPage.expectComplete();

  const imported = await fetchImportedTransactions(page, descriptions);
  expect(imported).toHaveLength(2);

  for (const tx of imported) {
    expect(tx.owner).toBe("Unassigned");
  }
});

test("import flow reuses saved mapping for same file format", async ({ page: _, importFlowPage }) => {
  await importFlowPage.goto();
  await importFlowPage.page.evaluate(async () => {
    const app = (window as any).go.main.App;
    const mappings = await app.GetColumnMappings();
    await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
  });

  // First import: create and save mapping.
  await importFlowPage.uploadFile(headerCsvPath);
  await importFlowPage.mapDate("Date");
  await importFlowPage.mapAmount("Amount");
  await importFlowPage.mapDescription("Description");
  await importFlowPage.setAccountStatic("Checking");
  await importFlowPage.nextStep();
  await importFlowPage.mapColumn("Currency");
  await importFlowPage.nextStep();
  await importFlowPage.startImport();
  await importFlowPage.expectComplete();

  // Second import: mapping should be auto-detected and we can continue without clicking headers.
  await importFlowPage.goto();
  await importFlowPage.uploadFile(headerCsvPath);
  await importFlowPage.expectAutoMappingDetected();
  await importFlowPage.expectCanContinueWithoutRemapping();
});

test("import flow auto-maps next dropped file after saving mapping in the same session", async ({
  page,
  importFlowPage,
}) => {
  await importFlowPage.goto();
  await page.evaluate(async () => {
    const app = (window as any).go.main.App;
    const mappings = await app.GetColumnMappings();
    await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
  });

  await importFlowPage.uploadFiles([headerCsvPath, headerCsvCopyPath]);

  // File 1: create mapping (will be saved automatically on the last step).
  await importFlowPage.mapDate("Date");
  await importFlowPage.mapAmount("Amount");
  await importFlowPage.mapDescription("Description");
  await importFlowPage.setAccountStatic("Checking");
  await importFlowPage.nextStep();
  await importFlowPage.mapColumn("Currency");
  await importFlowPage.nextStep();

  // Month selector for file 1.
  await importFlowPage.completeMonthSelection();

  // File 2: mapping should already be applied.
  await importFlowPage.expectAutoMappingDetected();
  await importFlowPage.expectCanContinueWithoutRemapping();
});

test("import flow supports subset-match when bank adds a new column", async ({ page, importFlowPage }) => {
  await importFlowPage.goto();
  await page.evaluate(async () => {
    const app = (window as any).go.main.App;
    const mappings = await app.GetColumnMappings();
    await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
  });

  // Create and save mapping from the baseline format.
  await importFlowPage.uploadFile(headerCsvPath);
  await importFlowPage.mapDate("Date");
  await importFlowPage.mapAmount("Amount");
  await importFlowPage.mapDescription("Description");
  await importFlowPage.setAccountStatic("Checking");
  await importFlowPage.nextStep();
  await importFlowPage.mapColumn("Currency");
  await importFlowPage.nextStep();

  await importFlowPage.goto();

  // Upload a file with an extra column.
  await importFlowPage.uploadFile(headerCsvExtraColumnPath);
  await importFlowPage.expectAutoMappingDetected();
  await importFlowPage.expectCanContinueWithoutRemapping();
});

test("manual header override should prevent auto-matching", async ({ page, importFlowPage }) => {
  await importFlowPage.goto();
  await page.evaluate(async () => {
    const app = (window as any).go.main.App;
    const mappings = await app.GetColumnMappings();
    await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
  });

  // Create and save mapping.
  await importFlowPage.uploadFile(headerCsvPath);
  await importFlowPage.mapDate("Date");
  await importFlowPage.mapAmount("Amount");
  await importFlowPage.mapDescription("Description");
  await importFlowPage.setAccountStatic("Checking");
  await importFlowPage.nextStep();
  await importFlowPage.mapColumn("Currency");
  await importFlowPage.nextStep();

  await importFlowPage.goto();
  await importFlowPage.uploadFile(headerCsvPath);
  await importFlowPage.expectAutoMappingDetected();

  // Force headerSource=manual by toggling.
  await importFlowPage.ensureHeaderRow(false);
  await importFlowPage.ensureHeaderRow(true);

  await importFlowPage.expectAutoMappingNotDetected();
  await expect(importFlowPage.nextButton).toBeDisabled();
});

test("ambiguous duplicate headers should not be auto-matched", async ({ page, importFlowPage }) => {
  await importFlowPage.goto();
  await page.evaluate(async () => {
    const app = (window as any).go.main.App;
    const mappings = await app.GetColumnMappings();
    await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
  });

  // Create and save mapping.
  await importFlowPage.uploadFile(headerCsvPath);
  await importFlowPage.mapDate("Date");
  await importFlowPage.mapAmount("Amount");
  await importFlowPage.mapDescription("Description");
  await importFlowPage.setAccountStatic("Checking");
  await importFlowPage.nextStep();
  await importFlowPage.mapColumn("Currency");
  await importFlowPage.nextStep();

  await importFlowPage.goto();

  // This file has headers that collide after normalization ("Amount" and " amount ").
  await importFlowPage.uploadFile(headerCsvDuplicateHeadersPath);

  await importFlowPage.expectAutoMappingNotDetected();
  await expect(importFlowPage.nextButton).toBeDisabled();
});
