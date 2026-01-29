import { test as base } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { AnalysisPage } from "./pom/AnalysisPage";
import { CategorizationPage } from "./pom/CategorizationPage";
import { ImportFlowPage } from "./pom/ImportFlowPage";
import { SettingsPage } from "./pom/SettingsPage";

type MyFixtures = {
  dbReset: undefined;
  testDialogPaths: undefined;
  categorizationPage: CategorizationPage;
  analysisPage: AnalysisPage;
  importFlowPage: ImportFlowPage;
  settingsPage: SettingsPage;
};

const testRunId = process.env.CASHMOP_TEST_RUN_ID || "local";

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "test";

const getTestDir = () => {
  const dir = path.join(os.tmpdir(), "cashmop-test", testRunId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// Worker-specific baseURL helper
export const test = base.extend<MyFixtures>({
  // Override baseURL for worker-specific instance
  baseURL: async ({}, use, testInfo) => {
    const port = 34115 + testInfo.parallelIndex;
    await use(`http://localhost:${port}`);
  },

  // Auto-reset database before each test
  dbReset: [
    async ({}, use, testInfo) => {
      execSync("./build/bin/test-helper reset", {
        cwd: "..",
        env: {
          ...process.env,
          CASHMOP_WORKER_ID: testInfo.parallelIndex.toString(),
        },
      });
      await use();
    },
    { auto: true },
  ],

  testDialogPaths: [
    async ({ page }, use, testInfo) => {
      const dir = getTestDir();
      const slug = sanitize(testInfo.titlePath.join("_"));
      const backupSavePath = path.join(dir, `backup_${testInfo.parallelIndex}_${slug}.db`);
      const exportSavePath = path.join(dir, `export_${testInfo.parallelIndex}_${slug}.csv`);
      const paths = {
        backup_save_path: backupSavePath,
        export_save_path: exportSavePath,
        restore_open_path: "",
      };

      await page.addInitScript((p) => {
        const win = window as any;
        win.__cashmopTestDialogPaths = p;
        const apply = () => {
          const app = win.go?.main?.App;
          if (app?.SetTestDialogPaths) {
            app.SetTestDialogPaths(p);
            return true;
          }
          return false;
        };
        if (!apply()) {
          const interval = setInterval(() => {
            if (apply()) clearInterval(interval);
          }, 50);
          setTimeout(() => clearInterval(interval), 10000);
        }
      }, paths);

      await use();
    },
    { auto: true },
  ],

  categorizationPage: async ({ page }, use) => {
    await use(new CategorizationPage(page));
  },

  analysisPage: async ({ page }, use) => {
    await use(new AnalysisPage(page));
  },

  importFlowPage: async ({ page }, use) => {
    await use(new ImportFlowPage(page));
  },

  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});

export { expect } from "@playwright/test";
