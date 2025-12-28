# Integration Testing Refactor Proposal

## Goals
- Reduce boilerplate in tests.
- Decouple test logic from CSS selectors using POM (Page Object Model).
- Make tests more readable and expressive (User Story style).
- Automate database resets so tests don't have to manage them manually.

## Proposed Changes

### 1. Custom Playwright Fixtures
Introduce `frontend/tests/lib/fixtures.ts` to extend the standard `test` object.
- **Automatic Reset**: A fixture that automatically executes `./build/bin/test-helper reset` before every test.
- `categorizationPage`: Automatically instantiated POM.
- `analysisPage`: Automatically instantiated POM.

### 2. Page Object Models
Create POMs in `frontend/tests/lib/pom/`:
- `CategorizationPage.ts`: Methods like `categorize(categoryName)`, `expectTransaction(description)`.
- `AnalysisPage.ts`: Methods like `expectVisible()`, `selectDateRange(range)`.

### 3. Example Transformation

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
import { test } from './lib/fixtures';

test('should categorize', async ({ page, categorizationPage, analysisPage }) => {
  await page.goto('/');
  await categorizationPage.expectTransaction('Amazon.ca');
  await categorizationPage.categorize('Shopping');
  await analysisPage.expectVisible();
});
```

## Verification Plan
1. Implement `fixtures.ts` and POMs.
2. Migrate `basic.spec.ts` to the new structure and remove manual `beforeEach` and `execSync`.
3. Run `./scripts/run-integration-tests.sh` to ensure everything still passes.
