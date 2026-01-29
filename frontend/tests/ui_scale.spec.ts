import { expect, test } from "./lib/fixtures";

test("should support browser-style UI zoom shortcuts", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Navigate to Categories", { exact: true }).waitFor({ state: "visible", timeout: 10000 });

  // Ensure a known starting point and that we don't wipe the persisted value
  // on the reload we use to verify persistence.
  await page.evaluate(() => {
    localStorage.removeItem("cashmop.uiScale");
  });
  await page.reload();
  await page.getByLabel("Navigate to Categories", { exact: true }).waitFor({ state: "visible", timeout: 10000 });

  const fontSize = async () =>
    page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));

  const base = await fontSize();
  expect(base).toBeGreaterThan(15);
  expect(base).toBeLessThan(17);

  await page.keyboard.press("Control+Equal");
  const zoomed = await fontSize();
  expect(zoomed).toBeGreaterThan(base + 0.5);

  await page.reload();
  await page.getByLabel("Navigate to Categories", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  const zoomedAfterReload = await fontSize();
  expect(zoomedAfterReload).toBeCloseTo(zoomed, 1);

  await page.keyboard.press("Control+Digit0");
  const reset = await fontSize();
  expect(reset).toBeCloseTo(base, 1);
});
