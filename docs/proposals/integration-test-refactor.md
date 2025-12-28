# Integration Testing Refactor Proposal

## Goals
- Reduce boilerplate in tests.
- Enable scenario-specific database seeding.
- Decouple test logic from CSS selectors using POM (Page Object Model).
- Make tests more readable and expressive (User Story style).

## Proposed Changes

### 1. Enhanced `test-helper`
Modify the Go test-helper to support:
```bash
./test-helper reset [scenario]
```
- Scenarios will be subdirectories in `frontend/tests/fixtures/`.
- If no scenario is provided, it uses the root `fixtures/` directory (default).

### 2. Custom Playwright Fixtures
Introduce `frontend/tests/lib/fixtures.ts` to extend the standard `test` object.
- `db`: Provides a `reset(scenario?: string)` method.
- `categorizationPage`: Automatically instantiated POM.
- `analysisPage`: Automatically instantiated POM.

### 3. Page Object Models
Create POMs in `frontend/tests/lib/pom/`:
- `CategorizationPage.ts`: Methods like `categorize(categoryName)`, `expectTransaction(description)`.
- `AnalysisPage.ts`: Methods like `expectVisible()`, `selectDateRange(range)`.

### 4. Example Transformation

**Before:**
```typescript
test('should categorize', async ({ page }) => {
  execSync('./build/bin/test-helper reset', { cwd: '..' });
  await page.goto('/');
  await page.waitForSelector('text=Amazon.ca');
  await page.getByPlaceholder('Type a category...').fill('Shopping');
  await page.getByLabel('Categorize').click();
  await expect(page.getByRole('heading', { name: 'Financial Analysis' })).toBeVisible();
});
```

**After:**
```typescript
test('should categorize', async ({ page, db, categorizationPage, analysisPage }) => {
  db.reset();
  await page.goto('/');
  await categorizationPage.expectTransaction('Amazon.ca');
  await categorizationPage.categorize('Shopping');
  await analysisPage.expectVisible();
});
```

## Verification Plan
1. Update `test-helper` and verify it can load from a subdirectory.
2. Implement `fixtures.ts` and POMs.
3. Migrate `basic.spec.ts` to the new structure.
4. Run `./scripts/run-integration-tests.sh` to ensure everything still passes.
