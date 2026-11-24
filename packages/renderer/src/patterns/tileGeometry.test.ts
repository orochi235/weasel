import { describe, expect, it } from 'vitest';
import type { TilePatternSpec } from '@weasel-js/paint';
import { tileGeometry, type TileShape } from './tileGeometry';

/** Whether `shape`, drawn as `drawTileShapes` draws it (a line butt-capped), covers `(x, y)`. */
function covers(shape: TileShape, x: number, y: number): boolean {
  switch (shape.kind) {
    case 'line': {
      const dx = shape.x2 - shape.x1, dy = shape.y2 - shape.y1;
      const len = Math.hypot(dx, dy);
      const along = ((x - shape.x1) * dx + (y - shape.y1) * dy) / len;
      const across = Math.abs((x - shape.x1) * dy - (y - shape.y1) * dx) / len;
      return along >= 0 && along <= len && across <= shape.width / 2;
    }
    default:
      throw new Error(`no coverage test for ${shape.kind}`);
  }
}

/** Points inside the tile, inset from its edges, the tile's shapes cover differently from `plane`, the pattern
 *  the tile repeats into. */
function seams(spec: TilePatternSpec, plane: (x: number, y: number) => boolean): string[] {
  const { size, shapes } = tileGeometry(spec);
  const out: string[] = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = 0.01 + ((size - 0.02) * i) / n, y = 0.01 + ((size - 0.02) * j) / n;
      const drawn = shapes.some((s) => covers(s, x, y));
      if (drawn !== plane(x, y)) out.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
  }
  return out;
}

/** How far `v`, a coordinate across the diagonals, sits from the nearest one, which run every `size`. */
const across = (v: number, size: number) => (v - Math.round(v / size) * size) / Math.SQRT2;
const near = (d: number, width: number) => Math.abs(d) <= width / 2;
const onEdge = (d: number, width: number) => Math.abs(Math.abs(d) - width / 2) < 1e-6;

describe('tileGeometry', () => {
  it('repeats a hatch thicker than its corner stubs reach without notches at the corners', () => {
    const size = 10, width = 4;
    const plane = (x: number, y: number) => near(across(x + y, size), width);
    const edge = (x: number, y: number) => onEdge(across(x + y, size), width);
    const missed = seams({ kind: 'hatch', color: 'red', size, lineWidth: width }, plane)
      .filter((p) => !edge(...(p.split(',').map(Number) as [number, number])));
    expect(missed).toEqual([]);
  });

  it('repeats a crosshatch thicker than its corner stubs reach without notches at the corners', () => {
    const size = 12, width = 5;
    const plane = (x: number, y: number) => near(across(x + y, size), width) || near(across(x - y, size), width);
    const edge = (x: number, y: number) => onEdge(across(x + y, size), width) || onEdge(across(x - y, size), width);
    const missed = seams({ kind: 'crosshatch', color: 'red', size, lineWidth: width }, plane)
      .filter((p) => !edge(...(p.split(',').map(Number) as [number, number])));
    expect(missed).toEqual([]);
  });
});

describe('tileGeometry on sizes that draw nothing', () => {
  it('scatters no chunks of zero, negative or NaN size, or at an infinite density', () => {
    for (const [chunkSize, density] of [[0, 0.35], [0, 0], [-2, 0.35], [NaN, 0.35], [3, Infinity]]) {
      const shapes = tileGeometry({ kind: 'chunks', color: 'red', bg: 'blue', chunkSize, density }).shapes;
      expect(shapes.map((s) => s.kind)).toEqual(['rect']);
    }
  });

  it('draws no dot of a negative or NaN radius, which a canvas arc throws on', () => {
    for (const radius of [-1, NaN]) {
      expect(tileGeometry({ kind: 'dots', color: 'red', radius }).shapes).toEqual([]);
    }
  });

  it('draws no hatch line of a width that is not positive, which a canvas would draw at its last width', () => {
    for (const kind of ['hatch', 'crosshatch'] as const) {
      for (const lineWidth of [0, -1, NaN]) {
        expect(tileGeometry({ kind, color: 'red', lineWidth }).shapes).toEqual([]);
      }
    }
  });

  it('rounds a fractional size to the whole pixels a raster tile holds', () => {
    const geometry = tileGeometry({ kind: 'hatch', color: 'red', size: 5.5 });
    expect(geometry.size).toBe(6);
    expect(geometry).toEqual(tileGeometry({ kind: 'hatch', color: 'red', size: 6 }));
  });

  it('scatters no more chunks than the tile has pixels, however small or dense they are asked to be', () => {
    for (const spec of [{ chunkSize: 0.01 }, { density: 1e6 }]) {
      const { shapes } = tileGeometry({ kind: 'chunks', color: 'red', size: 16, ...spec });
      expect(shapes.length).toBeLessThanOrEqual(16 * 16 * 4);
    }
  });
});

describe('dots wider than half the tile', () => {
  it('draws a dot again past each edge it crosses', () => {
    const { shapes } = tileGeometry({ kind: 'dots', color: 'red', size: 6, radius: 4 });
    const centers = shapes.map((s) => (s.kind === 'circle' ? `${s.cx},${s.cy}` : s.kind)).sort();
    expect(centers).toEqual(['-3,-3', '-3,3', '-3,9', '3,-3', '3,3', '3,9', '9,-3', '9,3', '9,9']);
  });

  it('fills the tile once one dot covers it', () => {
    const { shapes } = tileGeometry({ kind: 'dots', color: 'red', size: 6, radius: 1000 });
    expect(shapes).toEqual([{ kind: 'rect', x: 0, y: 0, width: 6, height: 6, color: 'red' }]);
  });

  it('draws a chunk wider than the tile again at every period it reaches', () => {
    const s = 10;
    const shapes = tileGeometry({ kind: 'chunks', color: 'red', size: s, chunkSize: 20, density: 50 }).shapes
      .filter((e) => e.kind === 'ellipse');
    const at = new Set(shapes.map((e) => `${e.cx},${e.cy}`));
    let farthest = 0;
    for (const e of shapes) {
      const reach = Math.max(e.rx, e.ry);
      for (const o of [-2 * s, -s, s, 2 * s]) {
        const x = e.cx + o;
        if (x - reach < s && x + reach > 0) expect(at.has(`${x},${e.cy}`)).toBe(true);
      }
      farthest = Math.max(farthest, Math.abs(e.cx - s / 2));
    }
    // Past one and a half tiles from the middle is a copy two periods out.
    expect(farthest).toBeGreaterThan(1.5 * s);
  });

  it('fills the tile once a chunk covers it, however far it reaches', () => {
    const { shapes } = tileGeometry({ kind: 'chunks', color: 'red', size: 4, chunkSize: 1e6, density: 1e12 });
    expect(shapes).toEqual([{ kind: 'rect', x: 0, y: 0, width: 4, height: 4, color: 'red' }]);
  });

  it('keeps the background under a chunk that covers the tile', () => {
    const { shapes } = tileGeometry({
      kind: 'chunks', color: 'rgba(0,0,0,0.5)', bg: '#f00', size: 8, chunkSize: 40, density: 1e6,
    });
    expect(shapes).toEqual([
      { kind: 'rect', x: 0, y: 0, width: 8, height: 8, color: '#f00' },
      { kind: 'rect', x: 0, y: 0, width: 8, height: 8, color: 'rgba(0,0,0,0.5)' },
    ]);
  });
});
