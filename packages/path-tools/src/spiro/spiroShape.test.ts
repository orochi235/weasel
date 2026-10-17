import { describe, expect, it } from 'vitest';
import { pathToAnchors, worldEditToStorage, type PolygonPath, type SpiroPoint } from '@weasel-js/geom';
import { pathEditPathOf as editPathOf, resolveEditablePathOf, storeEditablePath as store } from '@weasel-js/core';
import { spiroExtension } from './spiroRepresentation';
import { spiroNodeData, spiroOf } from './spiroShape';

type Shape = { pose: unknown; data: unknown };
const EXTENSIONS = [spiroExtension];
const pathEditPathOf = (node: Shape) => editPathOf(node, EXTENSIONS);
const storeEditablePath = (node: Shape, path: PolygonPath) => store(node, path, EXTENSIONS);

const points: SpiroPoint[] = [
  { x: 0, y: 0, kind: 'smooth' },
  { x: 80, y: 70, kind: 'smooth' },
  { x: 170, y: 10, kind: 'corner' },
  { x: 260, y: 100, kind: 'smooth' },
];

/** A spiro node storing its curve as the pose. */
function poseNode() {
  const { path, representation } = spiroNodeData([{ points, closed: false }]);
  return { pose: path as unknown, data: { representation, tag: 1 } as unknown };
}

/** The same curve stored on `data.path` under a rotated rect pose. */
function dataNode() {
  const { path, representation } = spiroNodeData([{ points, closed: false }]);
  const stored = worldEditToStorage({ x: 0, y: 0, width: 1, height: 1, rotation: 0.3 }, path);
  return { pose: stored.pose as unknown, data: { path: stored.path, representation } as unknown };
}

const xy = (path: PolygonPath) => pathToAnchors(path).anchors.flat().map((a) => [a.x, a.y]);

describe('a spiro node in path edit', () => {
  it('edits its points, through a straight-sided control path', () => {
    const control = pathEditPathOf(poseNode())!;
    const { anchors } = pathToAnchors(control);
    expect(anchors[0].map((a) => [a.x, a.y])).toEqual(points.map((p) => [p.x, p.y]));
    expect(anchors[0].every((a) => !a.inHandle && !a.outHandle)).toBe(true);
    expect(pathToAnchors(resolveEditablePathOf(poseNode())!).anchors[0].length).toBeGreaterThan(points.length);
  });

  it('solves the curve again through a moved point, keeping each kind', () => {
    const node = poseNode();
    const control = pathEditPathOf(node)!;
    const moved = { ...control, coords: Float32Array.from(control.coords) };
    moved.coords[3] = 120;
    const next = storeEditablePath(node, moved)!;
    const spiro = spiroOf(next.data)!;
    expect(spiro.kinds).toEqual(['smooth', 'smooth', 'corner', 'smooth']);
    expect((next.data as { tag: number }).tag).toBe(1);
    const curve = pathToAnchors(next.pose as PolygonPath).anchors[0];
    expect([curve[spiro.at[1]].x, curve[spiro.at[1]].y]).toEqual([80, 120]);
    expect(xy(pathEditPathOf(next)!)).toEqual([[0, 0], [80, 120], [170, 10], [260, 100]]);
  });

  it('does the same for a curve stored on data.path under a rotated pose', () => {
    const node = dataNode();
    const control = pathEditPathOf(node)!;
    const before = xy(control);
    const next = storeEditablePath(node, control)!;
    xy(pathEditPathOf(next)!).forEach(([x, y], i) => {
      expect(x).toBeCloseTo(before[i][0], 3);
      expect(y).toBeCloseTo(before[i][1], 3);
    });
  });

  it('becomes plain geometry when its spiro no longer describes the path', () => {
    const node = poseNode();
    const broken = { ...node, data: { representation: { kind: 'spiro', kinds: ['smooth'], at: [5] } } };
    const path = resolveEditablePathOf(broken)!;
    expect(pathEditPathOf(broken)).toBe(path);
    expect(storeEditablePath(broken, path)!.data).toEqual({});
  });

  it('is edited as plain geometry, and loses its spiro, without the spiro representation', () => {
    const node = poseNode();
    const curve = resolveEditablePathOf(node)!;
    expect(editPathOf(node)).toBe(curve);
    expect(store(node, curve)!.data).toEqual({ tag: 1 });
  });
});
