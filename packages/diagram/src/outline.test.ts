import { describe, it, expect } from 'vitest';
import { boundsOfPath, polygonFromPoints, rectPath } from '@weasel-js/core';
import { boxForContent, contentBox, outlinePath, type Bounds } from './outline';

const BOX: Bounds = { x: 10, y: 20, width: 100, height: 40 };

/** How far the path strays outside the box it was built in. A shape that
 *  leaves its bounds is one that paints over its neighbors. */
function overflow(bounds: Bounds, b: { x: number; y: number; width: number; height: number }): number {
  return Math.max(
    bounds.x - b.x,
    bounds.y - b.y,
    b.x + b.width - (bounds.x + bounds.width),
    b.y + b.height - (bounds.y + bounds.height),
  );
}

describe('outlinePath', () => {
  it('gives a rect the bounds themselves', () => {
    expect(outlinePath('rect', BOX)).toEqual(rectPath(10, 20, 100, 40));
  });

  it('stretches a custom path in a unit square over the bounds', () => {
    const custom = polygonFromPoints([{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
    expect([...(outlinePath(custom, BOX) as { coords: Float32Array }).coords])
      .toEqual([60, 20, 110, 60, 10, 60]);
    // The same path follows the box when it moves.
    expect(boundsOfPath(outlinePath(custom, { ...BOX, x: 200 })).x).toBe(200);
  });

  for (const outline of ['rect', 'diamond', 'stadium', 'parallelogram', 'trapezoid'] as const) {
    it(`keeps a ${outline} inside its bounds`, () => {
      // A cubic's bounds are computed from the curve, not its hull, so a
      // stadium that bulges past its box shows up here.
      expect(overflow(BOX, boundsOfPath(outlinePath(outline, BOX)))).toBeLessThanOrEqual(1e-6);
    });

    it(`fills a ${outline}'s bounds in both axes`, () => {
      const b = boundsOfPath(outlinePath(outline, BOX));
      expect(b.width).toBeCloseTo(BOX.width, 3);
      expect(b.height).toBeCloseTo(BOX.height, 3);
    });

    it(`gives a ${outline} a zero-area box no geometry to paint`, () => {
      const b = boundsOfPath(outlinePath(outline, { x: 5, y: 5, width: 0, height: 0 }));
      expect(b.width).toBe(0);
      expect(b.height).toBe(0);
    });
  }

  it('puts a diamond\'s vertices on the four edge midpoints', () => {
    const path = outlinePath('diamond', BOX);
    expect([...(path as { coords: Float32Array }).coords]).toEqual([
      60, 20, 110, 40, 60, 60, 10, 40,
    ]);
  });

  it('leans a parallelogram one fifth of its width', () => {
    const coords = [...(outlinePath('parallelogram', BOX) as { coords: Float32Array }).coords];
    expect(coords.slice(0, 2)).toEqual([30, 20]);   // top-left, leaned right
    expect(coords.slice(6, 8)).toEqual([10, 60]);   // bottom-left, flush
  });

  it('never folds a parallelogram through itself, however narrow', () => {
    const coords = [...(outlinePath('parallelogram', { x: 0, y: 0, width: 4, height: 40 }) as
      { coords: Float32Array }).coords];
    // Top-left must not pass the top-right corner.
    expect(coords[0]!).toBeLessThanOrEqual(coords[2]!);
  });

  it('rounds a wide stadium on its left and right', () => {
    const b = boundsOfPath(outlinePath('stadium', { x: 0, y: 0, width: 100, height: 40 }));
    expect(b.width).toBeCloseTo(100, 3);
    expect(b.height).toBeCloseTo(40, 3);
  });

  it('stands a tall stadium up rather than making it an ellipse', () => {
    // A vertical pill has flat left and right edges: sampled at its own
    // mid-height, it is the full width of the box.
    const path = outlinePath('stadium', { x: 0, y: 0, width: 40, height: 100 });
    const b = boundsOfPath(path);
    expect(b.width).toBeCloseTo(40, 3);
    expect(b.height).toBeCloseTo(100, 3);
    const xs = [...(path as { coords: Float32Array }).coords].filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeCloseTo(0, 3);
    expect(Math.max(...xs)).toBeCloseTo(40, 3);
  });
});

describe('contentBox', () => {
  it('is the bounds themselves for a rect', () => {
    expect(contentBox('rect', BOX)).toEqual(BOX);
  });

  it("is a diamond's inscribed rect — the middle quarter", () => {
    expect(contentBox('diamond', { x: 0, y: 0, width: 200, height: 100 }))
      .toEqual({ x: 50, y: 25, width: 100, height: 50 });
  });

  it("gives up a parallelogram's lean on both sides", () => {
    expect(contentBox('parallelogram', { x: 0, y: 0, width: 100, height: 40 }))
      .toEqual({ x: 20, y: 0, width: 60, height: 40 });
  });

  it("is the flat span between a wide stadium's ends", () => {
    expect(contentBox('stadium', { x: 0, y: 0, width: 100, height: 40 }))
      .toEqual({ x: 20, y: 0, width: 60, height: 40 });
  });

  it('turns with a tall stadium', () => {
    expect(contentBox('stadium', { x: 0, y: 0, width: 40, height: 100 }))
      .toEqual({ x: 0, y: 20, width: 40, height: 60 });
  });

  it('takes a custom path at its bounds, having no shape opinion to offer', () => {
    expect(contentBox(rectPath(0, 0, 1, 1), BOX)).toEqual(BOX);
  });

  it("keeps content between a hexagon's points", () => {
    expect(contentBox('hexagon', { x: 0, y: 0, width: 100, height: 40 }))
      .toEqual({ x: 20, y: 0, width: 60, height: 40 });
  });

  for (const outline of ['rect', 'diamond', 'parallelogram', 'trapezoid', 'hexagon'] as const) {
    it(`boxForContent inverts contentBox for a ${outline}`, () => {
      const want = { width: 60, height: 40 };
      const box = boxForContent(outline, want);
      const got = contentBox(outline, { x: 0, y: 0, ...box });
      expect(got.width).toBeCloseTo(want.width, 6);
      expect(got.height).toBeCloseTo(want.height, 6);
    });
  }
});

describe('hexagon', () => {
  it('points left and right, a fifth of the width in from each side', () => {
    const path = outlinePath('hexagon', { x: 10, y: 20, width: 100, height: 40 });
    expect(path.kind).toBe('polygon');
    if (path.kind !== 'polygon') return;
    expect([...path.coords]).toEqual([10, 40, 30, 20, 90, 20, 110, 40, 90, 60, 30, 60]);
  });
});

describe('trapezoid', () => {
  const box = { x: 10, y: 20, width: 40, height: 80 };

  it('runs from a half-height left side to a full-height right side', () => {
    const path = outlinePath('trapezoid', box);
    expect(path.kind).toBe('polygon');
    if (path.kind !== 'polygon') return;
    expect([...path.coords]).toEqual([10, 40, 50, 20, 50, 100, 10, 80]);
  });

  it('keeps content inside the narrow side, and sizes a box to hold it', () => {
    expect(contentBox('trapezoid', box)).toEqual({ x: 10, y: 40, width: 40, height: 40 });
    expect(boxForContent('trapezoid', { width: 40, height: 40 })).toEqual({ width: 40, height: 80 });
  });
});

describe('ellipse', () => {
  it('passes through the middle of each side of its box', () => {
    const coords = [...(outlinePath('ellipse', { x: 0, y: 0, width: 100, height: 50 }) as { coords: Float32Array }).coords];
    const points = new Set<string>();
    for (let i = 0; i + 1 < coords.length; i += 2) points.add(`${coords[i]},${coords[i + 1]}`);
    for (const p of ['50,0', '100,25', '50,50', '0,25']) expect(points).toContain(p);
  });

  it('sizes its content box as the inscribed rect, and boxForContent inverts it', () => {
    const box = contentBox('ellipse', { x: 0, y: 0, width: 100, height: 50 });
    expect(box.width).toBeCloseTo(100 / Math.SQRT2);
    expect(box.height).toBeCloseTo(50 / Math.SQRT2);
    expect(box.x + box.width / 2).toBeCloseTo(50);
    expect(boxForContent('ellipse', box).width).toBeCloseTo(100);
  });
});
