import { describe, expect, it } from 'vitest';
import { pathFromD, pathLengthTable } from '@weasel-js/geom';
import { INHERIT, type PaintedStroke, type Stroke } from '@weasel-js/paint';
import { pathFromParts, type DerivedPart } from 'core/scene/derivedParts';
import type { Node } from 'core/scene/types';
import { findShapeInk, shapeCoversPoint } from './NodeShape';
import { solid } from '../util/paint';

type Pose = {
  x: number; y: number; width: number; height: number; rotation?: number; transform?: [number, number, number, number];
};

function node(data: unknown, pose: Pose): Node<unknown, 'default', Pose> {
  return { id: 'n', kind: 'mark', layer: 'default', pose, data, parentId: null } as unknown as Node<unknown, 'default', Pose>;
}

const LINE = pathFromD('M0 0 L100 0');
const LINE_POSE: Pose = { x: 0, y: 0, width: 100, height: 0 };
const stroke = (extra: Partial<Stroke> = {}): Stroke => ({ paint: solid('#000'), width: 2, ...extra });
const lineNode = (s: Stroke, pose: Pose = LINE_POSE) => node({ path: LINE, fill: null, stroke: s }, pose);

describe('shapeCoversPoint under a stroke trim', () => {
  it('hits only the visible span', () => {
    const n = lineNode(stroke({ trim: { end: 0.5 } }));
    expect(shapeCoversPoint(n, n.pose, 25, 0)).toBe(true);
    expect(shapeCoversPoint(n, n.pose, 75, 0)).toBe(false);
  });

  it('hits the whole line with no trim', () => {
    const n = lineNode(stroke());
    expect(shapeCoversPoint(n, n.pose, 25, 0)).toBe(true);
    expect(shapeCoversPoint(n, n.pose, 75, 0)).toBe(true);
  });

  it('hits nothing of a trim that draws nothing', () => {
    const n = lineNode(stroke({ trim: { start: 0.6, end: 0.4 } }));
    expect(shapeCoversPoint(n, n.pose, 50, 0)).toBe(false);
  });

  it('keeps a filled interior grabbable under a trim', () => {
    const square = pathFromD('M0 0 L100 0 L100 100 L0 100 Z');
    const pose = { x: 0, y: 0, width: 100, height: 100 };
    const n = node({ path: square, fill: { paint: solid('#fff') }, stroke: stroke({ trim: { end: 0.25 } }) }, pose);
    expect(shapeCoversPoint(n, pose, 50, 50)).toBe(true);
    expect(shapeCoversPoint(n, pose, 101, 50, { tolerance: 0 })).toBe(false);
    expect(shapeCoversPoint(n, pose, 50, -1)).toBe(true);
    // The fill's edge keeps the tolerance where the stroke is trimmed away.
    expect(shapeCoversPoint(n, pose, 101.5, 50, { tolerance: 2 })).toBe(true);
    expect(shapeCoversPoint(n, pose, 102.5, 50, { tolerance: 2 })).toBe(false);
    expect(shapeCoversPoint(n, pose, 50, -2.5, { tolerance: 2 })).toBe(true);
  });

  // The ribbon resolves an aligned rect's trim on the authored rect and cuts
  // the shifted one at the same anchor positions; picking tests the authored rect.
  it('measures an inner-aligned rect along its authored edges', () => {
    const pose = { x: 0, y: 0, width: 100, height: 50 };
    const rect = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const n = node({ path: rect, fill: null, stroke: stroke({ width: 10, align: 'inner', trim: { end: { length: 120 } } }) }, pose);
    expect(shapeCoversPoint(n, pose, 50, 5)).toBe(true);
    expect(shapeCoversPoint(n, pose, 95, 15)).toBe(true);
    expect(shapeCoversPoint(n, pose, 95, 32)).toBe(false);
    // Over-picks past the drawn end (y ≈ 21): the end's reach is the whole width, as at a butt-capped path end.
    expect(shapeCoversPoint(n, pose, 95, 28)).toBe(true);
    expect(shapeCoversPoint(n, pose, 50, 45)).toBe(false);
    // Nothing of an inner stroke lies outside the outline.
    expect(shapeCoversPoint(n, pose, 50, -3)).toBe(false);
  });

  it('measures lengths before the pose frame, as the ribbon does', () => {
    const pose: Pose = { ...LINE_POSE, transform: [2, 0, 0, 1] };
    const n = lineNode(stroke({ trim: { end: { length: 50 } } }), pose);
    // The frame stretches the line about its center to run from -50 to 150.
    expect(shapeCoversPoint(n, pose, -40, 0)).toBe(true);
    expect(shapeCoversPoint(n, pose, 40, 0)).toBe(true);
    expect(shapeCoversPoint(n, pose, 60, 0)).toBe(false);
  });

  it('starts a mirrored rect where the ribbon starts it, at its unmirrored top-left', () => {
    const pose: Pose = { x: 0, y: 0, width: 100, height: 50, transform: [-1, 0, 0, 1] };
    const rect = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const n = node({ path: rect, fill: null, stroke: stroke({ trim: { end: { length: 25 } } }) }, pose);
    expect(shapeCoversPoint(n, pose, 90, 0)).toBe(true);
    expect(shapeCoversPoint(n, pose, 10, 0)).toBe(false);
  });

  it('keeps the head at the window end grabbable', () => {
    const marked = lineNode(stroke({ markerEnd: 'arrow', trim: { end: 0.5 } }));
    const plain = lineNode(stroke({ trim: { end: 0.5 } }));
    const reach = findShapeInk(marked, marked.pose, { scale: 1 })!.outset;
    const off = (reach + 1) / 2;
    expect(off).toBeGreaterThan(1);
    expect(shapeCoversPoint(plain, plain.pose, 48, off)).toBe(false);
    expect(shapeCoversPoint(marked, marked.pose, 48, off)).toBe(true);
    expect(shapeCoversPoint(marked, marked.pose, 75, 0)).toBe(false);
  });

  it('measures a rotated line from its own start', () => {
    const pose: Pose = { ...LINE_POSE, rotation: Math.PI / 2 };
    const n = lineNode(stroke({ trim: { end: 0.5 } }), pose);
    // A quarter turn about (50, 0) runs the line from (50, -50) to (50, 50).
    expect(shapeCoversPoint(n, pose, 50, -25)).toBe(true);
    expect(shapeCoversPoint(n, pose, 50, 25)).toBe(false);
  });

  it('measures a stretched curve before the stretch', () => {
    const curve = pathFromD('M0 0 C0 50 100 50 100 0');
    const pose: Pose = { x: 0, y: 0, width: 100, height: 37.5, transform: [2, 0, 0, 1] };
    const half = pathLengthTable(curve).total / 2;
    const n = node({ path: curve, fill: null, stroke: stroke({ trim: { end: { length: half } } }) }, pose);
    // The curve at t, stretched about x = 50; half its own length ends at its apex.
    const at = (t: number): [number, number] => {
      const x = 300 * t * t * (1 - t) + 100 * t ** 3;
      return [2 * (x - 50) + 50, 150 * t * (1 - t)];
    };
    expect(shapeCoversPoint(n, pose, ...at(0.25))).toBe(true);
    expect(shapeCoversPoint(n, pose, ...at(0.45))).toBe(true);
    expect(shapeCoversPoint(n, pose, ...at(0.6))).toBe(false);
  });
});

describe('shapeCoversPoint memoizes a trimmed outline', () => {
  it('reads a changed inherited trim on the same node and pose', () => {
    const pose: Pose = { ...LINE_POSE, rotation: Math.PI / 2 };
    const n = node({ path: LINE, fill: null, stroke: INHERIT }, pose);
    const at = (end: number) => ({ inherited: { fill: null, stroke: stroke({ trim: { end } }) as PaintedStroke } });
    expect(shapeCoversPoint(n, pose, 50, 25, at(0.5))).toBe(false);
    expect(shapeCoversPoint(n, pose, 50, 25, at(1))).toBe(true);
    expect(shapeCoversPoint(n, pose, 50, 25, at(0.5))).toBe(false);
  });
});

describe('shapeCoversPoint on a derived path in parts', () => {
  const A = pathFromD('M0 0 L100 0');
  const B = pathFromD('M0 50 L100 50');
  const covers = (own: Stroke | null, parts: DerivedPart[], x: number, y: number) => {
    const n = { ...node({ fill: null, stroke: own }, { x: 0, y: 0, width: 0, height: 0 }), dependsOn: ['a'], derivePath: 'k' };
    return shapeCoversPoint(n as never, n.pose, x, y, { derivedPath: pathFromParts(parts) });
  };

  it("trims each part along its own length by the node's trim", () => {
    const parts: DerivedPart[] = [{ path: A, stroke: INHERIT }, { path: B, stroke: INHERIT }];
    const own = stroke({ trim: { end: 0.5 } });
    expect(covers(own, parts, 25, 0)).toBe(true);
    expect(covers(own, parts, 75, 0)).toBe(false);
    expect(covers(own, parts, 25, 50)).toBe(true);
    expect(covers(own, parts, 75, 50)).toBe(false);
  });

  it("keeps a part's own untrimmed stroke whole under a trimmed node", () => {
    const parts: DerivedPart[] = [{ path: A, stroke: INHERIT }, { path: B, stroke: stroke() }];
    const own = stroke({ trim: { end: 0.5 } });
    expect(covers(own, parts, 75, 0)).toBe(false);
    expect(covers(own, parts, 75, 50)).toBe(true);
  });

  it('hits nothing of a part whose trim draws nothing', () => {
    const parts: DerivedPart[] = [{ path: A, stroke: INHERIT }, { path: B, stroke: stroke({ trim: { start: 1 } }) }];
    expect(covers(stroke(), parts, 75, 0)).toBe(true);
    expect(covers(stroke(), parts, 50, 50)).toBe(false);
  });
});
