import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

let testEnvPromise: Promise<boolean> | null = null;

const resolveTestEnv = async () => {
  if (!testEnvPromise) {
    testEnvPromise = (window as any).go?.main?.App?.IsTestEnv?.()
      .then((value: boolean) => Boolean(value))
      .catch(() => false);
  }
  return testEnvPromise;
};

export const openExternal = (url: string) => {
  void (async () => {
    if (await resolveTestEnv()) return; // Avoid OS browser in integration tests.
    BrowserOpenURL(url);
  })();
};
