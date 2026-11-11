/**
 * Property test of the scene slot's cull: a shape node `paintMissesView` drops, with `defaultPaintBounds`, under
 * a turned, sheared, or flipped pose and any view, is one whose own commands, wrapped in its pose frame as the
 * walk wraps them, the renderer's per-command cull drops too. So skipping its painter loses no pixel the
 * renderer would have drawn in view.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cullDrawCommands } from '@weasel-js/renderer';
import { viewToMat3 } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import type { View } from 'core/viewport/view';
import { defaultDrawOne, defaultPaintBounds } from './defaultDrawOne';
import { paintMissesView } from './paintCull';
import { wrapWithPoseRotation } from './poseRotation';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = 400;
const INK = { kind: 'solid', color: '#000000' } as const;

const pose = fc.record({
  x: fc.double({ min: -500, max: 500, noNaN: true }),
  y: fc.double({ min: -500, max: 500, noNaN: true }),
  width: fc.double({ min: 1, max: 300, noNaN: true }),
  height: fc.double({ min: 1, max: 300, noNaN: true }),
  rotation: fc.option(fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }), { nil: undefined }),
  transform: fc.option(fc.tuple(
    fc.double({ min: -2, max: 2, noNaN: true }), fc.double({ min: -1, max: 1, noNaN: true }),
    fc.double({ min: -1, max: 1, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true }),
  ).filter(([a, b, c, d]) => Math.abs(a * d - b * c) > 0.05), { nil: undefined }),
}, { requiredKeys: ['x', 'y', 'width', 'height'] });

const stroke: fc.Arbitrary<Stroke> = fc.record({
  width: fc.oneof(fc.double({ min: 0.5, max: 30, noNaN: true }), fc.double({ min: 0.5, max: 12, noNaN: true }).map((px) => ({ px }))),
  align: fc.constantFrom('center', 'inner', 'outer'),
  join: fc.constantFrom('miter', 'round', 'bevel'),
  markerMid: fc.option(fc.constantFrom('arrow', 'diamond', 'dot'), { nil: undefined }),
}, { requiredKeys: ['width'] }).map((s) => ({ ...s, paint: INK }) as Stroke);

const shape = fc.oneof(
  fc.constantFrom({ shape: 'rect' }, { shape: 'ellipse' }),
  fc.integer({ min: 3, max: 8 }).map((sides) => ({ shape: 'polygon', sides })),
  fc.integer({ min: 3, max: 7 }).map((points) => ({ shape: 'star', points })),
);

const view: fc.Arbitrary<View> = fc.record({
  x: fc.double({ min: -800, max: 800, noNaN: true }),
  y: fc.double({ min: -800, max: 800, noNaN: true }),
  s: fc.double({ min: 0.1, max: 6, noNaN: true }),
  flip: fc.boolean(),
}).map(({ x, y, s, flip }) => ({ x, y, scale: { x: s, y: flip ? -s : s } }));

const rect = fc.record({
  x: fc.double({ min: -200, max: 200, noNaN: true }), y: fc.double({ min: -200, max: 200, noNaN: true }),
  width: fc.double({ min: 10, max: 1200, noNaN: true }), height: fc.double({ min: 10, max: 900, noNaN: true }),
});

describe('paintMissesView', () => {
  it('drops only a node whose wrapped commands the renderer’s cull drops as well', () => {
    let culled = 0, kept = 0;
    fc.assert(fc.property(shape, pose, fc.option(stroke, { nil: null }), view, rect, (d, p, s, v, r) => {
      const node = { id: 'n', kind: 'mark', layer: 'main', pose: p, data: { ...d, fill: { paint: INK }, stroke: s } } as never;
      const misses = paintMissesView(defaultPaintBounds, v, r)(node, p);
      const cmds = wrapWithPoseRotation(defaultDrawOne(node, p, v), p);
      const survivors = cullDrawCommands(cmds, viewToMat3(v), r, 1);
      if (misses) {
        culled++;
        expect(survivors).toEqual([]);
      } else if (survivors.length > 0) kept++;
    }), runs(RUNS));
    expect(culled).toBeGreaterThan(RUNS / 10);
    expect(kept).toBeGreaterThan(RUNS / 10);
  }, timeoutFor(RUNS, 5));
});
