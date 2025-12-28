import { test as base } from '@playwright/test';
import { CategorizationPage } from './pom/CategorizationPage';
import { AnalysisPage } from './pom/AnalysisPage';
import { execSync } from 'child_process';

type MyFixtures = {
  dbReset: void;
  categorizationPage: CategorizationPage;
  analysisPage: AnalysisPage;
};

export const test = base.extend<MyFixtures>({
  // Auto-reset database before each test
  dbReset: [async ({}, use) => {
    execSync('./build/bin/test-helper reset', { cwd: '..' });
    await use();
  }, { auto: true }],

  categorizationPage: async ({ page }, use) => {
    await use(new CategorizationPage(page));
  },

  analysisPage: async ({ page }, use) => {
    await use(new AnalysisPage(page));
  },
});

export { expect } from '@playwright/test';
