import { describe, expect, it } from 'vitest';
import { boundsOfPath, pathContainsPoint } from '@weasel-js/geom';
import { boxForContent, contentBox, outlineDetail, outlinePath, type Bounds } from '../outline';

const ADDED = [
  'roundRect', 'cylinder', 'document', 'note', 'cloud', 'triangle', 'octagon', 'folder', 'cube', 'actor', 'doubleEllipse',
  'component', 'doubleRect',
] as const;
const WITH_DETAIL = new Set(['cylinder', 'note', 'folder', 'cube', 'doubleEllipse', 'component', 'doubleRect']);

const BOXES: Bounds[] = [
  { x: 10, y: 20, width: 240, height: 160 },
  { x: -5, y: 0, width: 120, height: 50 },
  { x: 0, y: 0, width: 50, height: 120 },
];

/** A point a hair inside a content-box corner must be inside the filled shape. */
function cornersInside(outline: string, b: Bounds): boolean {
  const c = contentBox(outline, b);
  const e = 0.5;
  const path = outlinePath(outline, b);
  return [
    [c.x + e, c.y + e], [c.x + c.width - e, c.y + e],
    [c.x + e, c.y + c.height - e], [c.x + c.width - e, c.y + c.height - e],
  ].every(([px, py]) => pathContainsPoint(path, px!, py!));
}

describe.each(ADDED)('%s', (outline) => {
  it.each(BOXES)('stays inside its bounds at %o', (b) => {
    const got = boundsOfPath(outlinePath(outline, b));
    expect(got.x).toBeGreaterThanOrEqual(b.x - 1e-3);
    expect(got.y).toBeGreaterThanOrEqual(b.y - 1e-3);
    expect(got.x + got.width).toBeLessThanOrEqual(b.x + b.width + 1e-3);
    expect(got.y + got.height).toBeLessThanOrEqual(b.y + b.height + 1e-3);
  });

  if (outline !== 'actor') {
    it.each(BOXES)('keeps its content box inside the shape at %o', (b) => {
      expect(cornersInside(outline, b)).toBe(true);
    });
  }

  it('sizes a box whose content holds what was asked for', () => {
    for (const want of [{ width: 80, height: 20 }, { width: 20, height: 60 }]) {
      const box = boxForContent(outline, want);
      const got = contentBox(outline, { x: 0, y: 0, ...box });
      expect(got.width).toBeGreaterThanOrEqual(want.width - 1e-6);
      expect(got.height).toBeGreaterThanOrEqual(want.height - 1e-6);
    }
  });

  it(WITH_DETAIL.has(outline) ? 'has a detail inside its bounds' : 'has no detail', () => {
    const b = BOXES[0]!;
    const detail = outlineDetail(outline, b);
    if (!WITH_DETAIL.has(outline)) return expect(detail).toBeNull();
    const got = boundsOfPath(detail!);
    expect(got.x).toBeGreaterThanOrEqual(b.x - 1e-3);
    expect(got.y + got.height).toBeLessThanOrEqual(b.y + b.height + 1e-3);
  });
});

describe('actor', () => {
  it('puts its label in the strip under the figure', () => {
    const b = BOXES[0]!;
    const figure = boundsOfPath(outlinePath('actor', b));
    const c = contentBox('actor', b);
    expect(c.y).toBeCloseTo(figure.y + figure.height, 3);
    expect(c.y + c.height).toBeCloseTo(b.y + b.height, 6);
  });
});

describe('cylinder', () => {
  it('starts its content below the rim', () => {
    const b = BOXES[0]!;
    const rim = boundsOfPath(outlineDetail('cylinder', b)!);
    expect(contentBox('cylinder', b).y).toBeGreaterThanOrEqual(rim.y + rim.height - 1e-3);
  });
});

describe('octagon and cube', () => {
  it('invert their content boxes exactly', () => {
    for (const outline of ['octagon', 'cube']) {
      const want = { width: 60, height: 40 };
      const got = contentBox(outline, { x: 0, y: 0, ...boxForContent(outline, want) });
      expect(got.width).toBeCloseTo(want.width, 6);
      expect(got.height).toBeCloseTo(want.height, 6);
    }
  });
});

describe('component and doubleRect', () => {
  it('keep their content clear of the component glyph and inside the inner border', () => {
    const b = BOXES[0]!;
    const glyph = boundsOfPath(outlineDetail('component', b)!);
    const c = contentBox('component', b);
    expect(c.x + c.width).toBeLessThanOrEqual(glyph.x);
    expect(c.x - b.x).toBeCloseTo(b.x + b.width - (c.x + c.width), 6);
    const inner = boundsOfPath(outlineDetail('doubleRect', b)!);
    expect(contentBox('doubleRect', b)).toEqual({ x: inner.x, y: inner.y, width: inner.width, height: inner.height });
  });
});
