/**
 * Tiger-SVG repro for the delete/undo z-order regression (TODO entry
 * cleared in the same change that fixed the bug at the op-batch layer).
 *
 * Flow:
 *   1. Open swillustrator
 *   2. Inject a multi-path SVG via the "Open" file picker
 *   3. Screenshot the canvas (bufBefore)
 *   4. Cmd/Ctrl+A → Delete → Cmd/Ctrl+Z → Escape (deselect)
 *   5. Screenshot the canvas (bufAfter)
 *   6. Assert bufBefore ≈ bufAfter — if delete-batch undo restores paint
 *      order correctly, the two screenshots are pixel-identical (modulo
 *      tiny AA variance). If the regression returns, the topmost paths
 *      shuffle and the pixel diff is huge.
 *
 * Manual-run only; not wired into CI or prepublishOnly. Invoke via
 *   npm run test:e2e:swill
 */
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/** Synthetic SVG with N overlapping rects in a deliberate z-stack. Distinct
 *  fills + offset positions mean any reshuffling of paint order produces a
 *  large pixel diff at the overlap regions. */
function makeStackedSvg(): string {
  const N = 24;
  const W = 600, H = 400;
  // Hex-fill ramp — each adjacent stack layer is a visibly distinct color so
  // a z-order shuffle is unmistakable in pixel comparison.
  const hexAt = (t: number): string => {
    // Travel a hue-ish 6-stop ramp in RGB. Saturation high, value mid.
    const stops: [number, number, number][] = [
      [220, 60, 60],   // red
      [220, 140, 60],  // orange
      [220, 210, 60],  // yellow
      [70, 200, 90],   // green
      [60, 140, 220],  // blue
      [180, 80, 220],  // purple
    ];
    const s = t * (stops.length - 1);
    const i = Math.min(Math.floor(s), stops.length - 2);
    const f = s - i;
    const [r0, g0, b0] = stops[i];
    const [r1, g1, b1] = stops[i + 1];
    const r = Math.round(r0 + (r1 - r0) * f);
    const g = Math.round(g0 + (g1 - g0) * f);
    const b = Math.round(b0 + (b1 - b0) * f);
    const hh = (n: number): string => n.toString(16).padStart(2, '0');
    return `#${hh(r)}${hh(g)}${hh(b)}`;
  };
  const rects: string[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = 40 + i * 8;
    const y = 40 + i * 6;
    const w = W - 80 - i * 12;
    const h = H - 80 - i * 10;
    rects.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hexAt(t)}"/>`,
    );
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
    `width="${W}" height="${H}">` +
    rects.join('') +
    `</svg>`
  );
}

async function waitForRepaint(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  ));
}

test('multi-delete + undo preserves paint order', async ({ page }) => {
  await page.goto('/weasel/swillustrator/');
  await page.waitForSelector('.swill-canvas-host canvas');
  await waitForRepaint(page);
  await page.waitForTimeout(200);

  // Click "Open" and feed the SVG buffer via the filechooser.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Open' }).click(),
  ]);
  await fileChooser.setFiles({
    name: 'stacked.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(makeStackedSvg(), 'utf8'),
  });

  // Let the parse + scene-populate settle.
  await waitForRepaint(page);
  await page.waitForTimeout(300);

  const canvasHost = page.locator('.swill-canvas-host');
  // Focus the canvas so keyboard input lands in the kit's keybinding handler.
  await canvasHost.locator('canvas').first().click({ position: { x: 5, y: 5 } });
  // The click selects under the cursor; clear selection so the "before"
  // screenshot has no selection chrome.
  await page.keyboard.press('Escape');
  await waitForRepaint(page);

  const bufBefore = await canvasHost.screenshot();

  await page.keyboard.press('ControlOrMeta+a');
  await waitForRepaint(page);
  await page.keyboard.press('Delete');
  await waitForRepaint(page);

  const bufCleared = await canvasHost.screenshot();
  expect(
    Buffer.compare(bufBefore, bufCleared),
    'delete should visibly change the canvas',
  ).not.toBe(0);

  await page.keyboard.press('ControlOrMeta+z');
  await waitForRepaint(page);
  // Undo restores both the items AND the prior selection — clear it so the
  // "after" screenshot has no selection chrome and matches "before".
  await page.keyboard.press('Escape');
  await waitForRepaint(page);
  await page.waitForTimeout(150);

  const bufAfter = await canvasHost.screenshot();

  // Pixel diff via pixelmatch. Tight tolerance — the fixed code should
  // round-trip perfectly; the regression shifts whole shapes around so
  // even a loose ratio catches it.
  const before = PNG.sync.read(bufBefore);
  const after = PNG.sync.read(bufAfter);
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  const diff = new PNG({ width: before.width, height: before.height });
  const mismatched = pixelmatch(
    before.data,
    after.data,
    diff.data,
    before.width,
    before.height,
    { threshold: 0.1 },
  );
  const ratio = mismatched / (before.width * before.height);
  expect(ratio, `mismatched pixels ratio ${ratio}`).toBeLessThan(0.005);
});
