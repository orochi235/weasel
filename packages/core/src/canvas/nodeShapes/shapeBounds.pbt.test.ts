/**
 * Property tests of the built-in shape painter's boxes: for rects, ellipses, polygons, and stars under any
 * stroke (world or `{ px }` width, any align, join, cap, miter limit, or dash) at any view scale, the paint
 * box the cull reads and the drawn box selection chrome sits on each hold the fill and the ribbon the
 * tessellator lays down, and the painter's own commands cover no more than that.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { DEFAULT_FLATTEN_TOLERANCE_PX } from '@weasel-js/renderer';
import { findShapeBounds } from 'canvas/NodeShape';
import { findShapeDrawnBounds } from 'canvas/drawnBounds';
import { defaultDrawOne } from 'canvas/defaultDrawOne';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { runs, timeoutFor } from 'canvas/pbt.fixture';
import { pathForShape } from './shapePainter';
import { strokedBounds } from './strokedBounds';

const RUNS = 300;
const INK = { kind: 'solid', color: '#000000' } as const;

const dim = fc.double({ min: 1, max: 200, noNaN: true });
const pose = fc.record({
  x: fc.double({ min: -100, max: 100, noNaN: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true }),
  width: dim,
  height: dim,
});

const stroke: fc.Arbitrary<Stroke> = fc.record({
  width: fc.oneof(fc.double({ min: 0.1, max: 20, noNaN: true }), fc.double({ min: 0.5, max: 10, noNaN: true }).map((px) => ({ px }))),
  align: fc.constantFrom('center', 'inner', 'outer'),
  join: fc.constantFrom('miter', 'round', 'bevel'),
  cap: fc.constantFrom('butt', 'round', 'square'),
  miterLimit: fc.option(fc.double({ min: 1, max: 12, noNaN: true }), { nil: undefined }),
  dash: fc.option(fc.array(fc.double({ min: 1, max: 20, noNaN: true }), { minLength: 2, maxLength: 4 }), { nil: undefined }),
  trim: fc.option(fc.record({ start: fc.double({ min: 0, max: 0.5, noNaN: true }), end: fc.double({ min: 0.5, max: 1, noNaN: true }) }), { nil: undefined }),
  markerMid: fc.option(fc.constantFrom('dot', 'diamond', 'arrow', 'square'), { nil: undefined }),
  markerStart: fc.option(fc.constantFrom('dot', 'arrow'), { nil: undefined }),
}, { requiredKeys: ['width'] }).map((s) => ({ ...s, paint: INK }) as Stroke);

const shape: fc.Arbitrary<{ shape: string; sides?: number; points?: number }> = fc.oneof(
  fc.constantFrom({ shape: 'rect' }, { shape: 'ellipse' }),
  fc.integer({ min: 3, max: 12 }).map((sides) => ({ shape: 'polygon', sides })),
  fc.integer({ min: 3, max: 9 }).map((points) => ({ shape: 'star', points })),
);

const scale = fc.double({ min: 0.25, max: 4, noNaN: true });

function union(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/** `inner` fits in `outer`, give or take float32 rounding of the tessellated vertices and `slack`. */
function expectWithin(inner: Bounds, outer: Bounds, what: string, slack = 0): void {
  const eps = slack + 1e-4 * Math.max(1, Math.abs(outer.x) + outer.width, Math.abs(outer.y) + outer.height);
  expect(inner.x, `${what}: left`).toBeGreaterThanOrEqual(outer.x - eps);
  expect(inner.y, `${what}: top`).toBeGreaterThanOrEqual(outer.y - eps);
  expect(inner.x + inner.width, `${what}: right`).toBeLessThanOrEqual(outer.x + outer.width + eps);
  expect(inner.y + inner.height, `${what}: bottom`).toBeLessThanOrEqual(outer.y + outer.height + eps);
}

describe('the shape painter’s boxes hold its ink', () => {
  it('paint box and drawn box each contain the fill and the tessellated ribbon', () => {
    const tally = { stroked: 0, px: 0, spiky: 0, drawn: 0, capped: 0 };
    fc.assert(fc.property(shape, pose, fc.option(stroke, { nil: null }), scale, (d, p, s, k) => {
      const node = { id: 'n', kind: 'mark', layer: 'main', pose: p, data: { ...d, fill: { paint: INK }, stroke: s } } as never;
      const path: Path = pathForShape(d, p);
      const ink = union(boundsOfPath(path), s ? strokedBounds(path, s, k) : null)!;
      const paint = findShapeBounds(node, p, { scale: k, leastScale: k });
      const drawn = findShapeDrawnBounds(node, p, { scale: k });
      expect(paint).not.toBeNull();
      expect(drawn).not.toBeNull();
      expectWithin(ink, paint!, 'paint box');
      // Curves and round joins are flattened to the renderer's tolerance, a different half-pixel at each place. An
      // ellipse a few pixels across flattens to a few facets whose miters stand off its even outset; the drawn box
      // follows the curve, so it is held to that only at a size where the facets are fine.
      if (d.shape !== 'ellipse' || Math.min(p.width, p.height) * k >= 8) {
        expectWithin(ink, drawn!, 'drawn box', DEFAULT_FLATTEN_TOLERANCE_PX / k);
        tally.drawn++;
      }
      const cmds = defaultDrawOne(node, p);
      expect(cmds).toHaveLength(1);
      expect((cmds[0] as { path: Path }).path).toEqual(path);
      if (s) {
        tally.stroked++;
        if (typeof s.width === 'object') tally.px++;
        if (d.shape === 'ellipse' && s.cap === 'square' && (s.dash || s.trim)) tally.capped++;
        if ((d.shape === 'star' || (d.shape === 'polygon' && d.sides! <= 4)) && s.join === 'miter' && s.align !== 'inner') tally.spiky++;
      }
    }), runs(RUNS));
    expect(tally.stroked).toBeGreaterThan(RUNS / 2);
    expect(tally.px).toBeGreaterThan(RUNS / 6);
    expect(tally.spiky).toBeGreaterThan(RUNS / 30);
    expect(tally.drawn).toBeGreaterThan(RUNS * 0.7);
    expect(tally.capped).toBeGreaterThan(RUNS / 60);
  }, timeoutFor(RUNS, 10));
});
