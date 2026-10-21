import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { fraction } from '@weasel-js/quantity';
import { page } from 'vitest/browser';
import { afterEach, expect, test } from 'vitest';
import { BandEditor } from './BandEditor';

// A label's box says where the font put its advance, not where its strokes landed, and the fraction bar
// has no box at all. So this reads the pixels.

afterEach(cleanup);

async function decodePng(base64: string): Promise<ImageData> {
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** How far each pixel is from the background, the image's commonest color, 0 to 1, row-major. */
function inkMap(img: ImageData): Float64Array {
  const counts = new Map<number, number>();
  for (let i = 0; i < img.data.length; i += 4) {
    const key = (img.data[i]! << 16) | (img.data[i + 1]! << 8) | img.data[i + 2]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const key = [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const bg = [(key >> 16) & 255, (key >> 8) & 255, key & 255];
  const ink = new Float64Array(img.width * img.height);
  for (let i = 0; i < ink.length; i++) {
    const d = [0, 1, 2].map((k) => Math.abs(img.data[i * 4 + k]! - bg[k]!));
    ink[i] = Math.max(...d) / 255;
  }
  return ink;
}

interface Run { left: number; right: number; center: number }

function must(run: Run | null, what: string, where: unknown): Run {
  if (!run) throw new Error(`no ink for ${what} in ${JSON.stringify(where)}`);
  return run;
}

/** The ink in columns [x0, x1) and rows [y0, y1): where it starts and stops, and the middle of that, in device
 *  pixels. The middle of the extent, not the ink's centroid: a 2 beside a 1 drags a centroid toward itself. */
function inkRun(ink: Float64Array, width: number, x0: number, x1: number, y0: number, y1: number): Run | null {
  let left = Infinity, right = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (ink[y * width + x]! < 0.3) continue;
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
    }
  }
  return left === Infinity ? null : { left, right, center: (left + right) / 2 };
}

/** The longest unbroken run of ink along row `y`, between columns x0 and x1. */
function longestRun(ink: Float64Array, width: number, x0: number, x1: number, y: number): number {
  let len = 0, longest = 0;
  for (let x = x0; x < x1; x++) {
    len = ink[y * width + x]! >= 0.4 ? len + 1 : 0;
    longest = Math.max(longest, len);
  }
  return longest;
}

/** The rows the fraction bar fills: every row whose unbroken ink is nearly as long as the longest. */
function barRows(ink: Float64Array, width: number, x0: number, x1: number, y0: number, y1: number): [number, number] {
  const runs = Array.from({ length: y1 - y0 }, (_, i) => longestRun(ink, width, x0, x1, y0 + i));
  const best = Math.max(...runs);
  const peak = y0 + runs.indexOf(best);
  let top = peak, bottom = peak + 1;
  while (top > y0 && runs[top - 1 - y0]! >= best * 0.8) top--;
  while (bottom < y1 && runs[bottom - y0]! >= best * 0.8) bottom++;
  return [top, bottom];
}

/** Drawn large, so a stroke's position is read to a fraction of a pixel at the size it ships. */
const ZOOM = 4;

test('a stacked fraction on the ruler: numerator, bar and denominator all centered on the notch', async () => {
  await page.viewport(1400, 400);
  const { container } = render(
    <div style={{ width: 320, padding: 8, background: 'white', color: 'black', zoom: ZOOM }}>
      <BandEditor
        value={[{ from: 1 / 64, data: 'a' }, { from: 1 / 8, data: 'b' }]}
        min={1 / 64}
        max={1 / 2}
        scale="linear"
        ticks={[1 / 12, 1 / 6, 1 / 3].map((at) => ({ at }))}
        display={fraction()}
        onChange={() => {}}
      />
    </div>,
  );
  await document.fonts.ready;
  const ruler = container.querySelector<HTMLElement>('[data-tick-at]')!.parentElement!;
  const img = await decodePng(await page.screenshot({ element: ruler, save: false }));
  const dpr = img.width / ruler.getBoundingClientRect().width;
  const scale = dpr * ZOOM;
  const ink = inkMap(img);
  const origin = ruler.getBoundingClientRect();
  const measured: { label: string; num: number; bar: number; den: number; left: number; right: number }[] = [];
  for (const tick of container.querySelectorAll<HTMLElement>('[data-tick-at]')) {
    const notchBox = tick.getBoundingClientRect();
    const labelBox = tick.firstElementChild!.getBoundingClientRect();
    const px = (v: number, from: number) => Math.round((v - from) * dpr);
    const clampY = (y: number) => Math.max(0, Math.min(img.height, y));
    const x0 = px(labelBox.left - 4, origin.left), x1 = px(labelBox.right + 4, origin.left);
    const ly0 = clampY(px(labelBox.top, origin.top)), ly1 = clampY(px(labelBox.bottom, origin.top));
    const notch = must(inkRun(ink, img.width, px(notchBox.left - 2, origin.left), px(notchBox.right + 2, origin.left), px(notchBox.top, origin.top), img.height), 'notch', [notchBox, origin, img.width, img.height]);
    const [barTop, barBottom] = barRows(ink, img.width, x0, x1, ly0, ly1);
    const barInk = must(inkRun(ink, img.width, x0, x1, barTop, barBottom), 'bar', [x0, x1, barTop, barBottom]);
    const num = must(inkRun(ink, img.width, x0, x1, ly0, barTop - 1), 'numerator', [x0, x1, ly0, barTop]);
    const den = must(inkRun(ink, img.width, x0, x1, barBottom + 1, ly1), 'denominator', [x0, x1, barBottom, ly1]);
    const off = (r: Run) => (r.center - notch.center) / scale;
    const past = {
      left: (Math.min(num.left, den.left) - barInk.left) / scale,
      right: (barInk.right - Math.max(num.right, den.right)) / scale,
    };
    measured.push({ label: tick.textContent!, num: off(num), bar: off(barInk), den: off(den), ...past });
  }
  const table = JSON.stringify(measured, (_, v: unknown) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v));
  expect(measured.length, table).toBe(3);
  for (const m of measured) {
    // CSS px at the size the ruler ships. The digits get more room than the bar: a 1's flag puts its ink
    // a third of a pixel left of its stem, and rasterizing differs a little from machine to machine.
    expect(Math.abs(m.bar), table).toBeLessThan(0.25);
    expect(Math.abs(m.num), table).toBeLessThan(0.6);
    expect(Math.abs(m.den), table).toBeLessThan(0.6);
    expect(Math.abs(m.left - m.right), table).toBeLessThan(0.4);
    expect(Math.min(m.left, m.right), table).toBeGreaterThan(0.5);
  }
});
