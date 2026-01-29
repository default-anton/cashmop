import { fileURLToPath } from "url";
import { expect, test } from "./lib/fixtures";

const isoCsvPath = fileURLToPath(new URL("./fixtures/import_iso_dec_01_2025.csv", import.meta.url));

// This test uses a negative offset timezone to reproduce the classic JS pitfall where
// `new Date("YYYY-MM-DD")` is parsed as UTC and can appear as the previous day locally.
// We ensure month bucketing stays correct for ISO date-only values.

test.describe("import month detection", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("ISO date-only rows should bucket into the correct month (Dec 2025, not Nov 2025)", async ({
    importFlowPage,
    page,
  }) => {
    await importFlowPage.goto();

    await page.evaluate(async () => {
      const app = (window as any).go.main.App;
      const mappings = await app.GetColumnMappings();
      await Promise.all(mappings.map((m: any) => app.DeleteColumnMapping(m.id)));
    });

    await importFlowPage.uploadFile(isoCsvPath);

    await importFlowPage.mapDate("Date");
    await importFlowPage.mapAmount("Amount");
    await importFlowPage.mapDescription("Description");
    await importFlowPage.setAccountStatic("Checking");
    // Skip optional Owner + Currency steps.
    await importFlowPage.nextStep();
    await importFlowPage.nextStep();

    await importFlowPage.waitForMonthSelector();

    await expect(importFlowPage.monthOptionButton("Dec 2025")).toBeVisible();
    await expect(importFlowPage.monthOptionButton("Nov 2025")).toHaveCount(0);
  });
});
