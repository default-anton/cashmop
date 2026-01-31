import { expect, test } from "./lib/fixtures";

test.describe("Owner Filter in Analysis", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to analysis page
    await page.goto("/");
    await page.getByLabel("Navigate to Analysis", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Financial Analysis" })).toBeVisible({ timeout: 15000 });
  });

  test("should show owner filter button above the table", async ({ page }) => {
    await expect(page.getByLabel("Owner filter", { exact: true })).toBeVisible();
  });

  test("should open owner filter popover when clicked", async ({ page }) => {
    await page.getByLabel("Owner filter", { exact: true }).click();

    // Should show filter content
    await expect(page.getByText("Filter by Owner", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Search owners", { exact: true })).toBeVisible();
  });

  test("should show all owners and No Owner option in filter", async ({ page }) => {
    await page.getByLabel("Owner filter", { exact: true }).click();

    // Should show "Me" and "Partner" from fixtures, and "No Owner" option
    await expect(page.locator("button").filter({ hasText: "Me", exact: true })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "Partner", exact: true })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "No Owner", exact: true })).toBeVisible();
  });

  test("should filter transactions by owner - Me", async ({ page }) => {
    // First verify all transactions are visible
    await expect(page.locator("tr").filter({ hasText: "Safeway" })).toBeVisible();
    await expect(page.locator("tr").filter({ hasText: "Subway" })).toBeVisible();

    // Open owner filter
    await page.getByLabel("Owner filter", { exact: true }).click();

    // Wait for filter content to be visible
    await expect(page.getByText("Filter by Owner", { exact: true })).toBeVisible();

    // Hover over Me row to reveal ONLY button, then click it
    const meButton = page.locator("button").filter({ hasText: "Me", exact: true });
    await meButton.hover();
    const meRow = meButton.locator("..");
    await meRow.locator("button", { hasText: "ONLY" }).click();

    // Close filter
    await page.keyboard.press("Escape");

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should show transactions owned by Me (Safeway, Salary, Amazon)
    await expect(page.locator("tr").filter({ hasText: "Safeway" })).toBeVisible();
    await expect(page.locator("tr").filter({ hasText: "Employer Inc" })).toBeVisible();

    // Should NOT show transactions owned by Partner (Subway, Netflix)
    await expect(page.locator("tr").filter({ hasText: "Subway" })).not.toBeVisible();
  });

  test("should filter transactions by owner - Partner", async ({ page }) => {
    // Open owner filter
    await page.getByLabel("Owner filter", { exact: true }).click();

    await expect(page.getByText("Filter by Owner", { exact: true })).toBeVisible();

    // Hover over Partner row to reveal ONLY button, then click it
    const partnerButton = page.locator("button").filter({ hasText: "Partner", exact: true });
    await partnerButton.hover();
    const partnerRow = partnerButton.locator("..");
    await partnerRow.locator("button", { hasText: "ONLY" }).click();

    // Close filter
    await page.keyboard.press("Escape");

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should show transactions owned by Partner (Subway, Netflix)
    await expect(page.locator("tr").filter({ hasText: "Subway" })).toBeVisible();

    // Should NOT show transactions owned by Me
    await expect(page.locator("tr").filter({ hasText: "Safeway" })).not.toBeVisible();
  });

  test("should filter by No Owner", async ({ page }) => {
    // Open owner filter
    await page.getByLabel("Owner filter", { exact: true }).click();

    await expect(page.getByText("Filter by Owner", { exact: true })).toBeVisible();

    // Hover over No Owner row to reveal ONLY button, then click it
    const noOwnerButton = page.locator("button").filter({ hasText: "No Owner", exact: true });
    await noOwnerButton.hover();
    const noOwnerRow = noOwnerButton.locator("..");
    await noOwnerRow.locator("button", { hasText: "ONLY" }).click();

    // Close filter
    await page.keyboard.press("Escape");

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should show transactions without owner (Tokyo Taxi, Starbucks)
    await expect(page.locator("tr").filter({ hasText: "Tokyo Taxi" })).toBeVisible();
    await expect(page.locator("tr").filter({ hasText: "Starbucks" })).toBeVisible();

    // Should NOT show transactions with owners
    await expect(page.locator("tr").filter({ hasText: "Safeway" })).not.toBeVisible();
  });

  test("should search owners in filter", async ({ page }) => {
    // Open owner filter
    await page.getByLabel("Owner filter", { exact: true }).click();

    await expect(page.getByText("Filter by Owner", { exact: true })).toBeVisible();

    // Search for "Part"
    await page.locator('input[placeholder="Search owners..."]').fill("Part");

    // Should show Partner but not Me
    await expect(page.locator("button").filter({ hasText: "Partner", exact: true })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "Me", exact: true })).not.toBeVisible();
  });
});
