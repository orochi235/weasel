/**
 * A 1px `{ px }` stroke is one device pixel wide in every direction at a 4:1
 * view, read back from real WebGL2 — the claim the glRecorder tests make about
 * vertices, made about pixels.
 *
 * The mean-scale width this replaced painted these lines 0.5px tall running
 * across, 2px wide running down, and 0.56px across the shallow diagonal, so
 * every check below sits far from where the old ink landed.
 *
 * Further down, the same view with lengths in mixed units: a `{ px }` head on
 * a world-width line, a world head and world `vertexWidths` on a `{ px }` line,
 * and a `{ px }` outline on text.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Path, Stroke } from '@weasel-js/core';
import { ellipsePath, linePath } from '@weasel-js/geom';
import { registerFont, registerFontOutlines, outlineStatus } from '@weasel-js/font';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import type { DrawCommand } from './DrawCommand';
import { renderSceneToPixels, type RasterImage } from '../canvas/renderSceneToPixels';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../../assets/fonts/inter/inter.ttf?url';

const SCALE = { x: 4, y: 1 };
const SOURCE = { x: 0, y: 0, width: 60, height: 240 };

/** World geometry, with where each lands on the 240×240 output in comments.
 *  The ellipse is four times as tall as it is wide, so it lands a circle. */
const SHAPES: Record<string, Path> = {
  across: linePath({ x: 5, y: 20 }, { x: 55, y: 20 }), // y 20, x 20–220
  down: linePath({ x: 30, y: 40 }, { x: 30, y: 90 }), // x 120, y 40–90
  diagonal: linePath({ x: 5, y: 100 }, { x: 45, y: 120 }), // (20,100)–(180,120)
  ellipse: ellipsePath({ x: 35, y: 140, width: 20, height: 80 }), // x 140–220, y 140–220
  rect: { kind: 'rect', x: 5, y: 160, width: 20, height: 30 }, // x 20–100, y 160–190
};

function renderCommands(cmds: DrawCommand[]): RasterImage {
  const scene = createScene<{ cmd: DrawCommand }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const cmd of cmds) scene.add({ kind: 'leaf', layer: 'main', pose: { ...SOURCE }, data: { cmd } });
  return renderSceneToPixels({
    scene, sourceRect: SOURCE, scale: SCALE, background: '#000000',
    drawOne: (node) => [node.data.cmd],
  });
}

function render(dash?: number[]): RasterImage {
  return renderCommands(Object.values(SHAPES).map((path) => ({
    kind: 'path', path,
    stroke: { paint: { color: '#ffffff' }, width: { px: 1 }, cap: 'butt', ...(dash ? { dash } : {}) },
  })));
}

const ink = (img: RasterImage, x: number, y: number) => img.data[(y * img.width + x) * 4] / 255;

/** Ink summed across a line's crossing: down each column in `cols` over
 *  `rows`, or along each row in `rows` over `cols`. */
function crossings(img: RasterImage, along: 'column' | 'row', cols: [number, number], rows: [number, number]): number[] {
  const out: number[] = [];
  const [outer, inner] = along === 'column' ? [cols, rows] : [rows, cols];
  for (let i = outer[0]; i < outer[1]; i++) {
    let sum = 0;
    for (let j = inner[0]; j < inner[1]; j++) sum += along === 'column' ? ink(img, i, j) : ink(img, j, i);
    out.push(sum);
  }
  return out;
}

/** Median ink of the crossings that hit ink at all — every crossing of a
 *  solid line, the dashes of a dashed one — and the share that did. The
 *  median, because a crossing through a dash's slanted end is fractional. */
function inkedMedian(sums: number[]): { median: number; inked: number } {
  const hit = sums.filter((s) => s > 0.3).sort((a, b) => a - b);
  return { median: hit[hit.length >> 1] ?? 0, inked: hit.length / sums.length };
}

/** Each crossing to measure: which way it runs, its window, and the ink one
 *  crossing of a 1px line carries there — more than 1 on the diagonal, where
 *  a column cuts the line at a slant. */
const CHECKS: { name: string; along: 'column' | 'row'; cols: [number, number]; rows: [number, number]; expected: number }[] = [
  { name: 'line across', along: 'column', cols: [30, 210], rows: [10, 30], expected: 1 },
  { name: 'line down', along: 'row', cols: [110, 130], rows: [45, 85], expected: 1 },
  { name: 'diagonal', along: 'column', cols: [30, 170], rows: [95, 126], expected: Math.hypot(160, 20) / 160 },
  { name: 'ellipse top', along: 'column', cols: [170, 190], rows: [132, 160], expected: 1 },
  { name: 'ellipse side', along: 'row', cols: [132, 165], rows: [170, 190], expected: 1 },
  { name: 'rect top', along: 'column', cols: [30, 90], rows: [150, 170], expected: 1 },
  { name: 'rect side', along: 'row', cols: [10, 30], rows: [165, 185], expected: 1 },
];

describe('a 1px stroke at a 4:1 view', () => {
  it.each(CHECKS)('is one pixel wide: $name', ({ along, cols, rows, expected }) => {
    const { median, inked } = inkedMedian(crossings(render(), along, cols, rows));
    expect(inked).toBe(1);
    expect(median).toBeCloseTo(expected, 1);
  });

  it.each(CHECKS)('is one pixel wide dashed: $name', ({ along, cols, rows, expected }) => {
    const { median, inked } = inkedMedian(crossings(render([6, 4]), along, cols, rows));
    expect(inked).toBeGreaterThan(0.3);
    expect(inked).toBeLessThan(0.9);
    expect(median).toBeCloseTo(expected, 1);
  });

  it('dashes in screen pixels whichever way the line runs', () => {
    const img = render([6, 4]);
    const runs = (sums: number[]) => {
      const lengths: number[] = [];
      let run = 0;
      for (const s of sums) {
        if (s > 0.5) run++;
        else if (run > 0) { lengths.push(run); run = 0; }
      }
      return lengths;
    };
    for (const n of runs(crossings(img, 'column', [20, 220], [10, 30]))) expect(Math.abs(n - 6)).toBeLessThanOrEqual(1);
    for (const n of runs(crossings(img, 'row', [110, 130], [40, 90]))) expect(Math.abs(n - 6)).toBeLessThanOrEqual(1);
  });
});

const WHITE = { color: '#ffffff' };
const ACROSS = linePath({ x: 5, y: 20 }, { x: 45, y: 20 }); // y 20, x 20–180
const DOWN = linePath({ x: 30, y: 40 }, { x: 30, y: 90 }); // x 120, y 40–90

const strokeOf = (path: Path, stroke: Stroke): DrawCommand => ({ kind: 'path', path, stroke });

/** The widest crossing of a head and where along the line it falls: an
 *  arrow is widest at its base, one head length back from the tip. */
function widest(sums: number[], from: number): { width: number; at: number } {
  let at = 0;
  for (let i = 1; i < sums.length; i++) if (sums[i] > sums[at]) at = i;
  return { width: sums[at], at: from + at };
}

/** An arrow `width` across its base at `base`, tapering to the tip over
 *  `length` pixels. The widest pixel crossing sits just inside the base and
 *  averages the taper across that pixel, so it reads a little under `width`. */
function expectHead(m: { width: number; at: number }, width: number, length: number, base: number): void {
  expect(m.width).toBeGreaterThan(width * (1 - 1 / length) - 0.25);
  expect(m.width).toBeLessThan(width + 0.25);
  expect(Math.abs(m.at - base)).toBeLessThanOrEqual(1);
}

describe('a head sized in other units than its line, at a 4:1 view', () => {
  // The arrow is 3 units long and 3 wide. A 4px head is 12px both ways in
  // either direction; through the mean scale of 2 it was 2 world units, 24px
  // long and 6 tall running across.
  it('builds a { px } head on a world-width line to its screen size, running across and down', () => {
    const head: Stroke = { width: 0.5, paint: WHITE, markerEnd: { key: 'arrow', size: { px: 4 } } };
    const img = renderCommands([strokeOf(ACROSS, head), strokeOf(DOWN, head)]);
    const across = widest(crossings(img, 'column', [140, 190], [0, 40]), 140);
    expectHead(across, 12, 12, 168);
    const down = widest(crossings(img, 'row', [100, 140], [50, 100]), 50);
    expectHead(down, 12, 12, 78);
  });

  // A 2-unit world head is 6 world units long and 6 wide, so the view
  // stretches it: 24px long and 6 tall running across, 6px long and 24 wide
  // running down. Built in the stretch, it came out 12 by 12 both ways.
  it('builds a world-sized head on a { px } line in world, running across and down', () => {
    const head: Stroke = { width: { px: 1 }, paint: WHITE, markerEnd: { key: 'arrow', size: 2 } };
    const img = renderCommands([strokeOf(ACROSS, head), strokeOf(DOWN, head)]);
    const across = widest(crossings(img, 'column', [140, 190], [0, 40]), 140);
    expectHead(across, 6, 24, 156);
    const down = widest(crossings(img, 'row', [100, 140], [50, 100]), 50);
    expectHead(down, 24, 6, 84);
  });

  // World widths of 2 are 2px running across and 8px running down; read in
  // the stretch they were 4px both ways.
  it('keeps vertexWidths world widths on a { px } line', () => {
    const tapered: Stroke = { width: { px: 1 }, paint: WHITE, cap: 'butt', vertexWidths: [2, 2] };
    const img = renderCommands([strokeOf(ACROSS, tapered), strokeOf(DOWN, tapered)]);
    expect(inkedMedian(crossings(img, 'column', [30, 170], [10, 30])).median).toBeCloseTo(2, 1);
    expect(inkedMedian(crossings(img, 'row', [105, 135], [45, 85])).median).toBeCloseTo(8, 1);
  });
});

describe('a 1px outline on text at a 4:1 view', () => {
  const FAMILY = 'anisotropic-inter';
  const text = (): DrawCommand => ({
    kind: 'text', x: 4, y: 100, align: 'left', style: { fontFamily: FAMILY, fontSize: 64 },
    runs: [{
      text: 'H', fontFamily: FAMILY, fontSize: 64, fontWeight: 400, fontStyle: 'normal',
      fill: null, stroke: { paint: WHITE, width: { px: 1 } },
      letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }],
  } as DrawCommand);

  beforeAll(async () => {
    await registerFont(FAMILY, {}, metricsUrl, atlasUrl);
    registerFontOutlines(FAMILY, {}, ttfUrl);
    // Outlines load on first use, so a render is what starts the fetch.
    for (let i = 0; i < 100 && outlineStatus(FAMILY) !== 'ready'; i++) {
      renderCommands([text()]);
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(outlineStatus(FAMILY)).toBe('ready');
  });

  /** Ink summed from the first inked pixel to the first clear one after it. */
  const firstRun = (img: RasterImage, along: 'row' | 'column', at: number): number => {
    let sum = 0;
    const n = along === 'row' ? img.width : img.height;
    for (let i = 0; i < n; i++) {
      const v = along === 'row' ? ink(img, i, at) : ink(img, at, i);
      if (v > 0.01) sum += v;
      else if (sum > 0) break;
    }
    return sum;
  };

  // The H's left stem: its outer edge runs down, its top edge across. Through
  // the mean scale the first painted 2px wide and the second half a pixel.
  it('is one pixel wide down the stem and across its top', () => {
    const img = renderCommands([text()]);
    let minX = img.width, minY = img.height, maxY = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (ink(img, x, y) <= 0.01) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    expect(maxY - minY).toBeGreaterThan(30);
    const mid = Math.round((minY + maxY) / 2);
    const down = [mid - 6, mid - 3, mid + 3, mid + 6].map((y) => firstRun(img, 'row', y)).sort((a, b) => a - b);
    const across = [3, 4, 5, 6].map((dx) => firstRun(img, 'column', minX + dx)).sort((a, b) => a - b);
    expect(down[2]).toBeCloseTo(1, 1);
    expect(across[2]).toBeCloseTo(1, 1);
  });
});
