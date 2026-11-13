import { describe, expect, it } from 'vitest';
import {
  transformPoint, lengthAtCurve, pathContainsPoint, pathFromD, pathLengthTable, pointAtLength, polygonFromPoints,
  polylineFromPoints, poseFrameOf, resolveCorners, transformPath, type PolygonPath,
} from '@weasel-js/geom';
import { trimSpan } from '@weasel-js/stroke';
import { INHERIT, type PaintedStroke, type Stroke } from '@weasel-js/paint';
import { pathFromParts, type DerivedPart } from 'core/scene/derivedParts';
import { _framedPartOutlineForTests } from './nodeShapes/derivedPainter';
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

describe('shapeCoversPoint under a stroke trim and a stretch', () => {
  // Anchor 1 turns about 2e-3 rad: rounded before the 4x stretch, too straight to round after it.
  const round = { shape: 'round', radius: 10 } as const;
  const nearlyStraight = {
    ...polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0.2 }, { x: 200, y: 100 }]),
    corners: [null, round, round, null],
  } as PolygonPath;
  const pose: Pose = { x: 0, y: 0, width: 200, height: 100, transform: [4, 0, 0, 1] };
  const trim = { end: { length: 250 } };

  /** Where the canvas ends the line: the cut on the local path, carried through the frame. */
  function canvasEnd(): [number, number] {
    const table = pathLengthTable(nearlyStraight);
    const { point } = pointAtLength(table, lengthAtCurve(table, trimSpan(nearlyStraight, trim)!.to));
    return transformPoint(poseFrameOf(pose)!, point[0], point[1]);
  }

  it("ends the picked span at the canvas's point on a corner the stretch would straighten", () => {
    const n = node({ path: nearlyStraight, fill: null, stroke: stroke({ width: 1, trim }) }, pose);
    const [x, y] = canvasEnd();
    expect(shapeCoversPoint(n, pose, x, y - 1, { tolerance: 0 })).toBe(true);
    expect(shapeCoversPoint(n, pose, x, y + 1, { tolerance: 0 })).toBe(false);
  });
});

describe('shapeCoversPoint on a stretched rounded fill', () => {
  it('picks the corner the canvas draws', () => {
    const round = { shape: 'round', radius: 10 } as const;
    const box = {
      ...polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]),
      corners: [round, round, round, round],
    } as PolygonPath;
    const pose: Pose = { x: 0, y: 0, width: 100, height: 100, transform: [4, 0, 0, 1] };
    const frame = poseFrameOf(pose)!;
    const drawn = transformPath(resolveCorners(box), frame);
    const afterFrame = transformPath(box, frame);
    const n = node({ path: box, fill: { paint: solid('#fff') }, stroke: null }, pose);
    // Inward along the stretched diagonal from the top-left corner, across both corners' arcs.
    const [cx, cy] = transformPoint(frame, 0, 0);
    let differs = 0;
    for (let k = 0; k <= 400; k++) {
      const x = cx + k * 0.05;
      const y = cy + k * 0.0125;
      const want = pathContainsPoint(drawn, x, y);
      if (want !== pathContainsPoint(afterFrame, x, y)) differs++;
      expect(shapeCoversPoint(n, pose, x, y, { tolerance: 0 }), `${x}, ${y}`).toBe(want);
    }
    expect(differs).toBeGreaterThan(0);
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

  it("keeps a framed part's trimmed outline across picks", () => {
    const parts: DerivedPart[] = [{ path: A, stroke: INHERIT }];
    const pose = { x: 0, y: 0, width: 100, height: 50, transform: [2, 0, 0, 1] as [number, number, number, number] };
    const n = { ...node({ fill: null, stroke: stroke({ trim: { end: 0.5 } }) }, pose), dependsOn: ['a'], derivePath: 'k' };
    const derivedPath = pathFromParts(parts);
    expect(shapeCoversPoint(n as never, pose, 0, 0, { derivedPath })).toBe(true);
    const kept = _framedPartOutlineForTests(A);
    expect(kept).toBeDefined();
    expect(shapeCoversPoint(n as never, pose, 0, 0, { derivedPath })).toBe(true);
    expect(_framedPartOutlineForTests(A)).toBe(kept);
    // A changed trim misses.
    const longer = { ...n, data: { fill: null, stroke: stroke({ trim: { end: 0.9 } }) } };
    expect(shapeCoversPoint(longer as never, pose, 100, 0, { derivedPath })).toBe(true);
    expect(_framedPartOutlineForTests(A)).not.toBe(kept);
  });

  it('hits nothing of a part whose trim draws nothing', () => {
    const parts: DerivedPart[] = [{ path: A, stroke: INHERIT }, { path: B, stroke: stroke({ trim: { start: 1 } }) }];
    expect(covers(stroke(), parts, 75, 0)).toBe(true);
    expect(covers(stroke(), parts, 50, 50)).toBe(false);
  });
});
