/**
 * Visual regression spec: rotated shapes in WeaselDraw.
 *
 * Asserts that rect, text, and polygon shapes render rotated about their
 * unrotated AABB center, exercising the wrapWithRotation helper wired into
 * the rect / text / path render layers in `apps/draw/src/App.tsx`.
 *
 * Interaction sequence:
 *   1. Open the WeaselDraw app shell.
 *   2. Use the dev-only `window.__wdDebug.replaceScene` hook to seed
 *      three rotated shapes.
 *   3. Capture each shape's region after the scene paints.
 *
 * Baseline capture (CI):
 *   PNG baselines must be generated on the project's pinned CI runner
 *   (Ubuntu 24.04, Playwright pinned via package-lock.json). See
 *   CONTRIBUTING.md "Updating baselines" — run `gh workflow run
 *   visual-update.yml` to produce baselines, then download the artifact
 *   and commit the PNGs alongside this spec.
 *
 * Rig caveat:
 *   This spec targets the WeaselDraw app, served on Vite's dev server
 *   for WeaselDraw (port 5174, see `apps/draw/vite.config.ts`). The visual
 *   rig's `playwright.config.ts` currently boots
 *   only the kit-demos vite config on port 5177; running this spec requires
 *   either pointing the rig at the WeaselDraw vite config or adding a
 *   second webServer entry. That integration is part of T2.11 baseline
 *   capture in the CI workflow, not local pixel comparison.
 *
 *   Until then, this file documents the test surface and `__wdDebug`
 *   contract that the renderer must satisfy. The `__wdDebug` hook itself
 *   is wired up in a future task (T2.10 wiring lives in `main.tsx`); this
 *   spec asserts the renderer contract once the hook exists.
 */
import { test, expect } from '@playwright/test';

test.describe('rotation — WeaselDraw renderer', () => {
  test.skip(
    ({ baseURL }) => !baseURL?.includes('5173'),
    'WeaselDraw dev server (port 5173) not booted by the visual rig yet; '
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
