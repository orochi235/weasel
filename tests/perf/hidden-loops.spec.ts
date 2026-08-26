/**
 * Proves the visibility gate stops real work. jsdom can check neither half of
 * this: `document.hidden` never changes there and rAF is a shim, so the unit
 * tests verify the gate's bookkeeping while this verifies its effect.
 *
 * The page is never really backgrounded — a headless tab stays visible to the
 * compositor and keeps firing frames throughout — so anything that stops here
 * is weasel's gate, not the browser's throttling.
 */

import { test, expect } from '@playwright/test';

interface FrameCounts {
  app: number;
  browser: number;
}

declare global {
  interface Window {
    __appFrames: number;
    __browserFrames: number;
    __setHidden: (hidden: boolean) => void;
  }
}

/** Counts the frames the app asks for, and pumps rAF independently so the
 *  browser's own clock keeps running while the page reports itself hidden. */
const instrument = () => {
  const raw = window.requestAnimationFrame.bind(window);
  window.__appFrames = 0;
  window.__browserFrames = 0;
  window.requestAnimationFrame = (cb) =>
    raw((t) => {
      window.__appFrames++;
      return cb(t);
    });
  const pump = () => {
    window.__browserFrames++;
    raw(pump);
  };
  raw(pump);
  window.__setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  };
};

test('a demo loop stops while the page reports itself hidden', async ({ page }) => {
  await page.addInitScript(instrument);
  await page.goto('/#custom-shader');
  await page.waitForTimeout(800);

  const counts = (): Promise<FrameCounts> =>
    page.evaluate(() => ({ app: window.__appFrames, browser: window.__browserFrames }));

  const span = async (ms: number): Promise<FrameCounts> => {
    const before = await counts();
    await page.waitForTimeout(ms);
    const after = await counts();
    return { app: after.app - before.app, browser: after.browser - before.browser };
  };

  const visible = await span(1500);
  await page.evaluate(() => window.__setHidden(true));
  const hidden = await span(1500);
  await page.evaluate(() => window.__setHidden(false));
  const resumed = await span(1500);

  console.log(
    `app frames — visible ${visible.app}, hidden ${hidden.app}, resumed ${resumed.app}; ` +
      `browser frames throughout — ${visible.browser}/${hidden.browser}/${resumed.browser}`,
  );

  expect(hidden.app).toBe(0);
  expect(visible.app).toBeGreaterThan(30);
  expect(resumed.app).toBeGreaterThan(30);
  // The browser never stopped: without the gate, hidden.app would track this.
  expect(hidden.browser).toBeGreaterThan(30);
});
