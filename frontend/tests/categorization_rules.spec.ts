import { test, expect } from './lib/fixtures';

type Point = { x: number; y: number };

type SelectionPoints = {
  start: Point;
  end: Point;
};

const descriptionSelector = '[aria-label="Transaction Description"]';

const getDescriptionLocator = (page: any) => page.locator(descriptionSelector);

const getDescriptionText = async (page: any) => {
  const locator = getDescriptionLocator(page);
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  return (await locator.textContent())?.trim() ?? '';
};

const skipToDescription = async (page: any, categorizationPage: any, description: string) => {
  for (let i = 0; i < 6; i += 1) {
    const current = await getDescriptionText(page);
    if (current === description) {
      return;
    }
    await categorizationPage.skip();
  }
  throw new Error(`Description not found: ${description}`);
};

const dragSelectDescription = async (page: any, startOffset: number, endOffset: number) => {
  await getDescriptionLocator(page).waitFor({ state: 'visible', timeout: 10000 });
  const points = await page.evaluate(({ selector, startOffset, endOffset }) => {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const totalLength = element.textContent?.length ?? 0;

    const pointForOffset = (offset: number) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let currentOffset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const text = node.textContent || '';
        const nextOffset = currentOffset + text.length;
        if (offset <= nextOffset) {
          const localOffset = Math.max(0, Math.min(offset - currentOffset, text.length));
          const range = document.createRange();
          range.setStart(node, localOffset);
          range.setEnd(node, localOffset);
          const rangeRect = range.getBoundingClientRect();
          return {
            x: rangeRect.left + Math.max(rangeRect.width, 1) / 2,
            y: rangeRect.top + rangeRect.height / 2,
          };
        }
        currentOffset = nextOffset;
      }
      return { x: rect.left + 6, y: rect.top + rect.height / 2 };
    };

    const start = pointForOffset(startOffset);
    const end = endOffset >= totalLength
      ? { x: rect.right + 30, y: rect.bottom + 40 }
      : pointForOffset(endOffset);

    return { start, end } as SelectionPoints;
  }, { selector: descriptionSelector, startOffset, endOffset });

  if (!points) {
    throw new Error('Unable to calculate selection points');
  }

  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y);
  await page.mouse.up();
};

const getRuleByMatchValue = async (page: any, matchValue: string) => {
  return page.evaluate(async (value) => {
    const rules = await (window as any).go.main.App.GetCategorizationRules();
    return rules.find((rule: any) => rule.match_value === value);
  }, matchValue);
};

const waitForRuleByMatchValue = async (page: any, matchValue: string) => {
  await expect.poll(() => getRuleByMatchValue(page, matchValue), {
    timeout: 5000,
  }).toBeTruthy();
  return getRuleByMatchValue(page, matchValue);
};

const syncFxRates = async (page: any) => {
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate(() => (window as any).go.main.App.SyncFxRates());
  await page.waitForFunction((expected) => {
    const app = (window as any).go?.main?.App;
    return app?.GetFxRateStatus?.().then((status: any) => status?.last_sync === expected);
  }, today, { timeout: 30000 });
};

test.describe('Categorization Rules', () => {
  test('should create starts_with rule from description selection', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    const description = page.getByLabel('Transaction Description', { exact: true });
    await description.waitFor({ state: 'visible', timeout: 10000 });
    await expect(description).toHaveText('Starbucks');
    await dragSelectDescription(page, 0, 4);
    await expect(page.getByText(/Matching descriptions/i)).toBeVisible();

    await categorizationPage.categorize('Coffee');

    const rule = await waitForRuleByMatchValue(page, 'Star');
    expect(rule).toBeTruthy();
    expect(rule.match_type).toBe('starts_with');
  });

  test('should create contains rule from description selection', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    await skipToDescription(page, categorizationPage, 'Amazon.ca');
    await dragSelectDescription(page, 1, 4);
    await expect(page.getByText(/Matching descriptions/i)).toBeVisible();

    await categorizationPage.categorize('Shopping');

    const rule = await waitForRuleByMatchValue(page, 'maz');
    expect(rule).toBeTruthy();
    expect(rule.match_type).toBe('contains');
  });

  test('should create ends_with rule from description selection', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    await skipToDescription(page, categorizationPage, 'Netflix');
    await dragSelectDescription(page, 3, 7);
    await expect(page.getByText(/Matching descriptions/i)).toBeVisible();

    await categorizationPage.categorize('Streaming');

    const rule = await waitForRuleByMatchValue(page, 'flix');
    expect(rule).toBeTruthy();
    expect(rule.match_type).toBe('ends_with');
  });

  test('should create CAD more-than amount rule', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    await dragSelectDescription(page, 0, 4);
    await page.getByRole('button', { name: /More/ }).click();
    const valueInput = page.getByPlaceholder('Value');
    await valueInput.fill('10');

    await categorizationPage.categorize('Coffee');

    const rule = await waitForRuleByMatchValue(page, 'Star');
    expect(rule).toBeTruthy();
    expect(rule.amount_min).toBeNull();
    expect(rule.amount_max).toBe(-1000);
  });

  test('should create CAD less-than amount rule', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    await dragSelectDescription(page, 0, 4);
    await page.getByRole('button', { name: /Less/ }).click();
    const valueInput = page.getByPlaceholder('Value');
    await valueInput.fill('5');

    await categorizationPage.categorize('Coffee');

    const rule = await waitForRuleByMatchValue(page, 'Star');
    expect(rule).toBeTruthy();
    expect(rule.amount_min).toBe(-500);
    expect(rule.amount_max).toBeNull();
  });

  test('should create CAD between amount rule', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    await dragSelectDescription(page, 0, 4);
    await page.getByRole('button', { name: 'Between' }).click();
    await page.getByPlaceholder('Min').fill('5');
    await page.getByPlaceholder('Max').fill('15');

    await categorizationPage.categorize('Coffee');

    const rule = await waitForRuleByMatchValue(page, 'Star');
    expect(rule).toBeTruthy();
    expect(rule.amount_min).toBe(-1500);
    expect(rule.amount_max).toBe(-500);
  });

  test('should create USD more-than amount rule with conversion defaults', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    await syncFxRates(page);
    await skipToDescription(page, categorizationPage, 'Brooklyn Bagel');
    await dragSelectDescription(page, 0, 8);

    await page.getByRole('button', { name: /More/ }).click();
    const valueInput = page.getByPlaceholder('Value');
    const defaultValue = await page.evaluate(async () => {
      const rate = await (window as any).go.main.App.GetFxRate('CAD', 'USD', '2023-10-03');
      if (!rate) return null;
      const currentValue = -2000 * rate.rate;
      return String(Math.abs(currentValue / 100) || '');
    });
    expect(defaultValue).toBeTruthy();
    await expect(valueInput).toHaveValue(defaultValue as string);

    await valueInput.fill('30');
    await categorizationPage.categorize('Travel');

    const rule = await waitForRuleByMatchValue(page, 'Brooklyn');
    expect(rule).toBeTruthy();
    expect(rule.amount_min).toBeNull();
    expect(rule.amount_max).toBe(-3000);
  });

  test('should create USD less-than amount rule', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    await syncFxRates(page);
    await skipToDescription(page, categorizationPage, 'Brooklyn Bagel');
    await dragSelectDescription(page, 0, 8);

    await page.getByRole('button', { name: /Less/ }).click();
    await page.getByPlaceholder('Value').fill('12');

    await categorizationPage.categorize('Travel');

    const rule = await waitForRuleByMatchValue(page, 'Brooklyn');
    expect(rule).toBeTruthy();
    expect(rule.amount_min).toBe(-1200);
    expect(rule.amount_max).toBeNull();
  });

  test('should create USD between amount rule', async ({ categorizationPage }) => {
    await categorizationPage.goto();
    const page = categorizationPage.page;

    await syncFxRates(page);
    await skipToDescription(page, categorizationPage, 'Brooklyn Bagel');
    await dragSelectDescription(page, 0, 8);

    await page.getByRole('button', { name: 'Between' }).click();
    await page.getByPlaceholder('Min').fill('8');
    await page.getByPlaceholder('Max').fill('22');

    await categorizationPage.categorize('Travel');

    const rule = await waitForRuleByMatchValue(page, 'Brooklyn');
    expect(rule).toBeTruthy();
    expect(rule.amount_min).toBe(-2200);
    expect(rule.amount_max).toBe(-800);
  });
});
