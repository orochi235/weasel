/**
 * Visual regression spec: hud-context-menu demo. Right-clicks a shape and
 * hovers the menu's second row, once per color mode, so the panel, its
 * highlight and its text are pinned against each mode's theme.
 *
 * Baselines: `UPDATE_SNAPSHOTS=1 npm run test:visual -- hud-context-menu`,
 * on a fleet node rather than a laptop, whose rasterizer differs.
 */
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { assertMatchesBaseline, captureCanvas, readCanvasPixels, waitForRepaint } from './diff.js';

const DEMO_ID = 'hud-context-menu';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

/** On the green shape; the menu opens with its top-left here. */
const AT = { x: 75, y: 85 };
/** Inside the second row (Delete): rows start 4px down and are 24px tall. */
const ROW_2 = { x: AT.x + 40, y: AT.y + 40 };

for (const mode of ['light', 'dark'] as const) {
  test(`${DEMO_ID} — ${mode}: the open menu highlights the hovered row`, async ({ page }) => {
    await page.addInitScript((m) => window.localStorage.setItem('ckd-mode', m), mode);
    const closed = await captureCanvas(page, `/#${DEMO_ID}`, { settleMs: 400 });
    const canvas = page.locator('canvas').first();
    const box = (await canvas.boundingBox())!;

    await page.mouse.click(box.x + AT.x, box.y + AT.y, { button: 'right' });
    await waitForRepaint(page);
    const open = await readCanvasPixels(canvas);
    // An updated baseline is written unchecked, so say here that each step drew.
    expect(open.equals(closed), 'the right-click should open a menu').toBe(false);

    await page.mouse.move(box.x + ROW_2.x, box.y + ROW_2.y);
    await waitForRepaint(page);
    const hovered = await readCanvasPixels(canvas);
    expect(hovered.equals(open), 'hovering a row should highlight it').toBe(false);

    assertMatchesBaseline(hovered, resolve(BASELINE_DIR, `${DEMO_ID}-${mode}.png`));
  });
}
