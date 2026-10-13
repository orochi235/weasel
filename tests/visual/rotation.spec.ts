/**
 * Visual regression spec: rect, text, and polygon shapes in WeaselDraw render
 * rotated about their unrotated AABB center.
 *
 * Skipped everywhere today. It targets the WeaselDraw dev server
 * (`ports.draw` in `scripts/dev-ports.json`), and the visual rig's
 * `playwright.config.ts` boots only the kit-demos vite config. The dev-only
 * `window.__wdDebug.replaceScene` hook it seeds through does not exist yet
 * either.
 */
import { test, expect } from '@playwright/test';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

test.describe('rotation — WeaselDraw renderer', () => {
  test.skip(
    ({ baseURL }) => !baseURL?.includes(String(ports.draw)),
    'WeaselDraw dev server not booted by the visual rig yet; '
    + 'see spec preamble for the CI workflow that captures baselines.',
  );

  test('rotated rect renders at 45° off-axis', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      // @ts-expect-error — dev-only debug hook installed by main.tsx
      window.__wdDebug?.replaceScene?.([
        {
          id: 'r1', kind: 'rect',
          x: 100, y: 100, width: 100, height: 60,
          fill: { color: '#3366ff' }, stroke: null,
          rotation: Math.PI / 4,
        },
      ]);
    });
    const canvas = page.locator('canvas').first();
    await expect(canvas).toHaveScreenshot('rotated-rect-45.png', { maxDiffPixelRatio: 0.01 });
  });

  test('rotated text renders at 30° off-axis', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      // @ts-expect-error — dev-only debug hook installed by main.tsx
      window.__wdDebug?.replaceScene?.([
        {
          id: 't1', kind: 'text',
          x: 80, y: 80, width: 200, height: 40,
          text: 'Rotated',
          rotation: Math.PI / 6,
        },
      ]);
    });
    const canvas = page.locator('canvas').first();
    await expect(canvas).toHaveScreenshot('rotated-text-30.png', { maxDiffPixelRatio: 0.02 });
  });

  test('rotated polygon renders at 90° off-axis', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      // @ts-expect-error — dev-only debug hook installed by main.tsx
      window.__wdDebug?.replaceScene?.([
        {
          id: 'p1', kind: 'path',
          x: 100, y: 100, width: 60, height: 100,
          closed: true,
          fill: { color: '#cc3366' }, stroke: null,
          rotation: Math.PI / 2,
          path: {
            kind: 'polygon',
            coords: [100, 100, 160, 100, 160, 200, 100, 200],
            commands: [1, 2, 2, 2, 4],
          },
        },
      ]);
    });
    const canvas = page.locator('canvas').first();
    await expect(canvas).toHaveScreenshot('rotated-polygon-90.png', { maxDiffPixelRatio: 0.01 });
  });
});
