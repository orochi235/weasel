import { describe, expect, it } from 'vitest';
import { drawPixelGrid, GRID_MIN_FACTOR, gridFits, softEdgeMask } from './pixelGrid';

type Rgb = [number, number, number];

function image(width: number, height: number, rgb: (x: number, y: number) => Rgb): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = rgb(x, y);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

const gray = (v: number): Rgb => [v, v, v];

describe('softEdgeMask', () => {
  it('marks a blended pixel between two flat runs, and not the runs', () => {
    const img = image(7, 1, (x) => gray([0, 0, 0, 128, 255, 255, 255][x] as number));
    expect(Array.from(softEdgeMask(img))).toEqual([0, 0, 0, 1, 0, 0, 0]);
  });

  it('finds a blend running down a column as well as across a row', () => {
    const img = image(1, 5, (_x, y) => gray([10, 10, 128, 240, 240][y] as number));
    expect(Array.from(softEdgeMask(img))).toEqual([0, 0, 1, 0, 0]);
  });

  it('does not mark a hard edge, whose pixels are each one run color', () => {
    const img = image(4, 1, (x) => gray(x < 2 ? 0 : 255));
    expect(Array.from(softEdgeMask(img))).toEqual([0, 0, 0, 0]);
  });

  it('takes a pixel within the tolerance of a neighbor as that neighbor, not a blend', () => {
    const img = image(3, 1, (x) => gray([0, 6, 255][x] as number));
    expect(Array.from(softEdgeMask(img))).toEqual([0, 0, 0]);
    expect(Array.from(softEdgeMask(img, 2))).toEqual([0, 1, 0]);
  });

  it('marks a blend between two colors that share a channel', () => {
    const img = image(
      3,
      1,
      (x) =>
        [
          [0, 255, 0],
          [128, 128, 0],
          [255, 0, 0],
        ][x] as Rgb,
    );
    expect(Array.from(softEdgeMask(img))).toEqual([0, 1, 0]);
  });

  it('does not mark a pixel that overshoots its neighbors in one channel', () => {
    const img = image(
      3,
      1,
      (x) =>
        [
          [0, 0, 0],
          [128, 255, 0],
          [255, 128, 0],
        ][x] as Rgb,
    );
    expect(Array.from(softEdgeMask(img))).toEqual([0, 0, 0]);
  });

  it('has an entry per pixel', () => {
    expect(softEdgeMask(image(1, 1, () => gray(9))).length).toBe(1);
    expect(softEdgeMask(image(3, 2, () => gray(9))).length).toBe(6);
  });
});

describe('gridFits', () => {
  it('is for a Pixels source at 8 CSS px per captured pixel and up', () => {
    expect(GRID_MIN_FACTOR).toBe(8);
    expect(gridFits('pixels', 8, 1)).toBe(true);
    expect(gridFits('pixels', 16, 2)).toBe(true);
    expect(gridFits('pixels', 12, 2)).toBe(false);
  });

  it('has no meaning over any other source', () => {
    expect(gridFits('live', 16, 1)).toBe(false);
    expect(gridFits(null, 16, 1)).toBe(false);
  });
});

type Call = [string, ...number[]];

// jsdom has no canvas: a recorder stands in for the context, so these assert where lines and tints land.
function recorder() {
  const calls: Call[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    stroke: () => {},
    clearRect: (...a: number[]) => calls.push(['clearRect', ...a]),
    moveTo: (...a: number[]) => calls.push(['moveTo', ...a]),
    lineTo: (...a: number[]) => calls.push(['lineTo', ...a]),
    fillRect: (...a: number[]) => calls.push(['fillRect', ...a]),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const COLORS = { line: 'black', tint: 'red' };
const verticals = (calls: Call[]) =>
  calls.filter((c) => c[0] === 'moveTo' && c[2] === 0).map((c) => c[1]);

describe('drawPixelGrid', () => {
  it('draws one vertical line per pixel boundary across the area, from where pixel 0 begins', () => {
    const { ctx, calls } = recorder();
    drawPixelGrid(
      ctx,
      { factor: 8, dpr: 1, origin: { x: 3, y: 5 }, columns: 100, size: { width: 30, height: 16 } },
      null,
      COLORS,
    );
    expect(verticals(calls)).toEqual([3, 11, 19, 27]);
  });

  it('spaces lines factor over dpr apart', () => {
    const { ctx, calls } = recorder();
    drawPixelGrid(
      ctx,
      { factor: 16, dpr: 2, origin: { x: 0, y: 3 }, columns: 100, size: { width: 17, height: 8 } },
      null,
      COLORS,
    );
    expect(verticals(calls)).toEqual([0, 8, 16]);
  });

  it('tints the cell of each marked pixel and no other', () => {
    const { ctx, calls } = recorder();
    const mask = new Uint8Array(4 * 2);
    mask[1 * 4 + 2] = 1;
    drawPixelGrid(
      ctx,
      { factor: 8, dpr: 1, origin: { x: 0, y: 0 }, columns: 4, size: { width: 32, height: 16 } },
      mask,
      COLORS,
    );
    expect(calls.filter((c) => c[0] === 'fillRect')).toEqual([['fillRect', 16, 8, 8, 8]]);
  });

  it('draws nothing below the smallest factor', () => {
    const { ctx, calls } = recorder();
    drawPixelGrid(
      ctx,
      { factor: 4, dpr: 1, origin: { x: 0, y: 0 }, columns: 4, size: { width: 32, height: 16 } },
      null,
      COLORS,
    );
    expect(calls).toEqual([['clearRect', 0, 0, 32, 16]]);
  });
});
