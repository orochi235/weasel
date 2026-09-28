/**
 * A painter's `bounds` lets culling skip `paint`, so it must enclose
 * everything `paint` emits — by the same measure `cullDrawCommands` applies to
 * the emitted commands. Each case probes a strip just outside the box on every
 * side and checks the painted commands cannot reach it.
 *
 * Paths are measured by their curve bounds, not by `cullDrawCommands`' control
 * hull, which is looser than the curve and so would reach past a box that
 * holds everything drawn.
 */
import { describe, expect, it } from 'vitest';
import { findShapeBounds, findNodeShape } from './NodeShape';
import { defaultDrawOne, defaultPaintBounds } from './defaultDrawOne';
import { cullDrawCommands } from '../renderer/cullDrawCommands';
import { mat3 } from '../renderer/math/mat3';
import { solid, strokeOf } from '../util/paint';
import { PATH_C, PATH_M, PATH_Z } from 'features/paths/types';
import { boundsOfPath } from 'features/paths/bounds';
import type { DrawCommand } from '../renderer';
import type { Node } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';

interface RectPose { x: number; y: number; width: number; height: number }

const POSE: RectPose = { x: 40, y: 30, width: 60, height: 20 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function node(data: Record<string, unknown>): Node<unknown, string, RectPose> {
  return { id: asNodeId('n'), kind: 'leaf', layer: 'main', pose: POSE, data } as unknown as Node<unknown, string, RectPose>;
}

const SPIKY = { ...strokeOf('#000', 6), miterLimit: 10, align: 'outer' as const };

/** A cubic whose control points sit far outside its own box. */
const CURVE = {
  kind: 'polygon' as const,
  commands: new Uint8Array([PATH_M, PATH_C, PATH_Z]),
  coords: new Float32Array([0, 0, -50, 80, 150, 80, 100, 0]),
};

const CASES: Array<[string, Record<string, unknown>]> = [
  ['a stroked rect shape', { shape: 'rect', fill: solid('#f00'), stroke: SPIKY }],
  ['a stroked star', { shape: 'star', stroke: SPIKY }],
  ['an ellipse', { shape: 'ellipse' }],
  ['a curved path with an arrowhead', { path: CURVE, stroke: { ...strokeOf('#000', 4), markerEnd: 'arrow' } }],
  ['an image placeholder', { image: { src: 'data:image/png;base64,' } }],
  ['a rect-fallback node', { fill: solid('#0f0') }],
];

const tightened = (c: DrawCommand): DrawCommand =>
  c.kind === 'path' ? { ...c, path: boundsOfPath(c.path) } : c;

describe('painter bounds', () => {
  for (const [label, data] of CASES) {
    it(`encloses what ${label} paints`, () => {
      const n = node(data);
      const b = findShapeBounds(n, POSE, { scale: 1 });
      expect(b, 'bounds').not.toBeNull();
      const cmds = findNodeShape(n)!.paint(n, POSE).map(tightened);
      const id = mat3.identity();
      const gap = 2;
      const strips = [
        { x: b!.x - 1000, y: -1000, width: 1000 - gap, height: 3000 },
        { x: b!.x + b!.width + gap, y: -1000, width: 1000, height: 3000 },
        { x: -1000, y: b!.y - 1000, width: 3000, height: 1000 - gap },
        { x: -1000, y: b!.y + b!.height + gap, width: 3000, height: 1000 },
      ];
      for (const strip of strips) expect(cullDrawCommands(cmds, id, strip), JSON.stringify(strip)).toEqual([]);
      expect(cullDrawCommands(cmds, id, b!)).not.toEqual([]);
    });
  }

  it('has none for text, which only layout can bound', () => {
    expect(findShapeBounds(node({ text: 'hi' }), POSE)).toBeNull();
  });
});

describe('defaultPaintBounds', () => {
  it('is the painter box for a plain node', () => {
    const n = node({ shape: 'rect' });
    expect(defaultPaintBounds(n, POSE, VIEW)).toEqual(findShapeBounds(n, POSE, { scale: 1 }));
  });

  it('has none for a node whose label overlay defaultDrawOne adds', () => {
    const n = node({ shape: 'rect', label: 'Zone A' });
    expect(defaultDrawOne(n, POSE, VIEW).some((c) => c.kind === 'text')).toBe(true);
    expect(defaultPaintBounds(n, POSE, VIEW)).toBeNull();
  });

  it('reads a screen-pixel stroke width at the view scale', () => {
    const n = node({ shape: 'rect', stroke: { ...strokeOf('#000', 1), width: { px: 8 } } });
    const near = defaultPaintBounds(n, POSE, { ...VIEW, scale: { x: 4, y: 4 } })!;
    const far = defaultPaintBounds(n, POSE, { ...VIEW, scale: { x: 0.5, y: 0.5 } })!;
    expect(far.width).toBeGreaterThan(near.width);
  });
});
