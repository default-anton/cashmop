import { expect, test } from "./lib/fixtures";

test("categories manager supports create, rename, quick rules, and delete", async ({ page }) => {
  const categoryName = "Spec Subscriptions";
  const renamedCategory = "Spec Streaming";
  await page.goto("/");
  await page.getByLabel("Navigate to Categories", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New Category", exact: true }).click();
  await page.getByLabel("New category name", { exact: true }).fill(categoryName);
  await page.getByRole("button", { name: "Create Category", exact: true }).click();

  const createdRow = page.getByRole("row").filter({ hasText: categoryName });
  await expect(createdRow).toBeVisible();

  await createdRow.getByLabel(`Rename category ${categoryName}`, { exact: true }).click();
  await page.getByLabel(`Edit category ${categoryName}`, { exact: true }).fill(renamedCategory);
  await page.getByLabel(`Save category ${categoryName}`, { exact: true }).click();

  const renamedRow = page.getByRole("row").filter({ hasText: renamedCategory });
  await expect(renamedRow).toBeVisible();

  await renamedRow.getByRole("button", { name: "Manage Rules", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Rules · ${renamedCategory}`, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New Rule", exact: true }).click();

  const categoryInput = page.getByLabel("Category for rule", { exact: true });
  await expect(categoryInput).toHaveValue(renamedCategory);
  await expect(categoryInput).toBeDisabled();

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Rules · ${renamedCategory}`, exact: true })).toBeVisible();
  await page.getByLabel("Close", { exact: true }).click();

  await renamedRow.getByLabel(`Delete category ${renamedCategory}`, { exact: true }).click();
  await page.getByRole("button", { name: "Delete + Uncategorize", exact: true }).click();

  await expect(page.getByRole("row").filter({ hasText: renamedCategory })).toHaveCount(0);
});

test("categories manager keyboard shortcuts speed up table and modal flows", async ({ page }) => {
  const categoryName = "Hotkey Utility";

  await page.goto("/");
  await page.getByLabel("Navigate to Categories", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();

  await page.keyboard.press("/");
  const categorySearch = page.getByLabel("Search categories", { exact: true });
  await expect(categorySearch).toBeFocused();

  await page.keyboard.press("ControlOrMeta+N");
  await expect(page.getByRole("heading", { name: "Create Category", exact: true })).toBeVisible();
  await page.getByLabel("New category name", { exact: true }).fill(categoryName);
  await page.keyboard.press("Enter");

  const createdRow = page.getByRole("row").filter({ hasText: categoryName });
  await expect(createdRow).toBeVisible();

  const groceriesRow = page.getByRole("row").filter({ hasText: "Groceries" });
  await groceriesRow.getByRole("button", { name: "Manage Rules", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rules · Groceries", exact: true })).toBeVisible();

  await page.keyboard.press("/");
  const ruleSearch = page.getByLabel("Search category rules", { exact: true });
  await expect(ruleSearch).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Rules · Groceries", exact: true })).toHaveCount(0);

  await createdRow.getByLabel(`Delete category ${categoryName}`, { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delete Category", exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Delete Category", exact: true })).toHaveCount(0);

  await createdRow.getByLabel(`Delete category ${categoryName}`, { exact: true }).click();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("row").filter({ hasText: categoryName })).toHaveCount(0);
});
