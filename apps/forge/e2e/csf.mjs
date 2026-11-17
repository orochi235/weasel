// Headless check that forge renders a sample of Storybook's CSF stories: node apps/forge/e2e/csf.mjs [origin] [screenshot-dir]
import { chromium } from '@playwright/test';
import ports from '../../../scripts/dev-ports.json' with { type: 'json' };
import { csfShot, csfChecks as stories } from './stories.mjs';

const [origin = `http://[::1]:${ports.forge}`, shots = '.'] = process.argv.slice(2);

const browser = await chromium.launch({ headless: true });
let failed = 0;
try {
  for (const [i, story] of stories.entries()) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ...(story.colorScheme ? { colorScheme: story.colorScheme } : {}),
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${origin}/#/${story.id}`);
      // The story just opened is the last host on the page; a host stays `data-pending` until its story has painted.
      const frame = page.locator('.fg-story[data-fg-host]').last();
      await page.locator('.fg-story[data-fg-host]:not([data-pending])').last().waitFor({ timeout: 20000 });
      await story.check({ page, frame });
      const faults = [
        ...(await page.locator('.fg-fault').allInnerTexts()),
        ...(await frame.locator('.fg-frame__fault').allInnerTexts()),
      ];
      if (faults.length > 0) throw new Error(`fault shown: ${faults.join(' | ')}`);
      if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`);
      const shot = csfShot(shots, i, story.id);
      await page.screenshot({ path: shot });
      console.log(`${i + 1}/${stories.length} ${story.id}  ok  (${story.what}) ${shot}`);
    } catch (error) {
      failed += 1;
      console.log(`${i + 1}/${stories.length} ${story.id}  FAIL  ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failed > 0) process.exit(1);
