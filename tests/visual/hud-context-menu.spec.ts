/**
 * Visual regression spec: hud-context-menu demo. Right-clicks a shape and
 * hovers the menu's second row, once per color mode, so the panel, its
 * highlight and its text are pinned against each mode's theme.
 *
 * Baselines: `UPDATE_SNAPSHOTS=1 npm run test:visual -- hud-context-menu`,
 * on a fleet node rather than a laptop, whose rasterizer differs.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { assertMatchesBaseline, readCanvasPixels, waitForRepaint } from './diff.js';

const DEMO_ID = 'hud-context-menu';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

/** On the green shape; the menu opens with its top-left here. */
const AT = { x: 75, y: 85 };
/** Rows start 4px down, 24px tall, with a 9px separator after the second. */
const ROW_2 = { x: AT.x + 40, y: AT.y + 40 };
/** Right of every label, so these read the row's background, not its text. */
const DELETE_BG = { x: AT.x + 150, y: AT.y + 40 };
const BRING_FORWARD_BG = { x: AT.x + 150, y: AT.y + 73 };

/** The canvas once two reads a few frames apart agree: the menu measures its
 *  labels again when the hud's font lands, so one frame is not the last. */
async function settled(page: Page, canvas: Locator): Promise<Buffer> {
  let last = await readCanvasPixels(canvas);
  await expect.poll(async () => {
    await waitForRepaint(page);
    const next = await readCanvasPixels(canvas);
    const same = next.equals(last);
    last = next;
    return same;
  }, { intervals: [100], timeout: 20_000 }).toBe(true);
  return last;
}

function rgba(png: Buffer, { x, y }: { x: number; y: number }): number[] {
  const { data, width } = PNG.sync.read(png);
  const i = (y * width + x) * 4;
  return [...data.subarray(i, i + 4)];
}

for (const mode of ['light', 'dark'] as const) {
  test(`${DEMO_ID} — ${mode}: the open menu highlights the hovered row`, async ({ page }) => {
    // A cold vite server's first load takes ~30s on a node (docs/TODO.md, "first page load").
    test.setTimeout(90_000);
    await page.addInitScript((m) => window.localStorage.setItem('ckd-mode', m), mode);
    await page.goto(`/#${DEMO_ID}`);
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ timeout: 60_000 });
    const box = (await canvas.boundingBox())!;
    const closed = await settled(page, canvas);

    await page.mouse.click(box.x + AT.x, box.y + AT.y, { button: 'right' });
    const open = await settled(page, canvas);
    expect(open.equals(closed), 'the right-click should open a menu').toBe(false);
    expect(rgba(open, DELETE_BG), 'no row is highlighted before the hover').toEqual(rgba(open, BRING_FORWARD_BG));

    await page.mouse.move(box.x + ROW_2.x, box.y + ROW_2.y);
    const hovered = await settled(page, canvas);
    expect(rgba(hovered, DELETE_BG), 'the hovered row is highlighted').not.toEqual(rgba(hovered, BRING_FORWARD_BG));

    assertMatchesBaseline(hovered, resolve(BASELINE_DIR, `${DEMO_ID}-${mode}.png`));
  });
}
