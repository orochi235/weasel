import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerNodeShape,
  findNodeShape,
  findShapeSilhouette,
  shapeCoversPoint,
  nodeShapeEntries,
  _resetShapePaintersForTests,
  type NodeShapeEntry,
} from './NodeShape';
import { solid, solidStroke } from '@weasel-js/paint';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '@weasel-js/renderer';

function node<TData>(data: TData): Node<TData, 'default', { x: number; y: number; width: number; height: number }> {
  return {
    id: 'n',
    kind: 'mark',
    layer: 'default',
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data,
    parent: null,
  } as Node<TData, 'default', { x: number; y: number; width: number; height: number }>;
}

beforeEach(() => {
  // Tests freely register/unregister; reset before each so cross-test
  // pollution can't leak. After reset, only the kit built-ins are
  // registered.
  _resetShapePaintersForTests();
});

describe('shape painter registry', () => {
  it('ships six built-ins in evaluation order: derived → path → shape → image → path-pose → rect-fallback', () => {
    const ids = nodeShapeEntries().map((p) => p.id);
    expect(ids).toEqual(['kit:derived', 'kit:path', 'kit:shape', 'kit:image', 'kit:path-pose', 'kit:rect-fallback']);
  });

  it('findNodeShape returns the first matching painter', () => {
    expect(findNodeShape(node({ path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } }))?.id).toBe('kit:path');
    expect(findNodeShape(node({ shade: '#abc' }))?.id).toBe('kit:rect-fallback');
  });

  it('registers a normal-priority painter after the built-ins, ahead of the rect fallback', () => {
    const custom: NodeShapeEntry = {
      id: 'app:heart',
      matches: (n) => (n.data as { heart?: unknown } | null)?.heart != null,
      paint: () => [],
    };
    registerNodeShape(custom);
    const ids = nodeShapeEntries().map((p) => p.id);
    expect(ids).toEqual(['kit:derived', 'kit:path', 'kit:shape', 'kit:image', 'app:heart', 'kit:path-pose', 'kit:rect-fallback']);
    // The fallback matches every rect-posed node, so a painter behind it would never paint one.
    expect(findNodeShape(node({ heart: 'x' }))?.id).toBe('app:heart');
    // A built-in that matches still wins over a normal-priority painter.
    const greedy: NodeShapeEntry = { id: 'app:greedy', matches: () => true, paint: () => [] };
    registerNodeShape(greedy);
    expect(findNodeShape(node({ shape: 'ellipse' }))?.id).toBe('kit:shape');
  });

  it("'high' priority painters beat the built-ins", () => {
    const overrideShape: NodeShapeEntry = {
      id: 'app:loud-shape',
      matches: (n) => (n.data as { shape?: string } | null)?.shape != null,
      paint: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } } as DrawCommand],
    };
    registerNodeShape(overrideShape, { priority: 'high' });
    expect(findNodeShape(node({ shape: 'ellipse' }))?.id).toBe('app:loud-shape');
  });

  it('within a tier, painters run in registration order (first-wins)', () => {
    const a: NodeShapeEntry = { id: 'a', matches: () => true, paint: () => [] };
    const b: NodeShapeEntry = { id: 'b', matches: () => true, paint: () => [] };
    registerNodeShape(a, { priority: 'high' });
    registerNodeShape(b, { priority: 'high' });
    expect(findNodeShape(node({}))?.id).toBe('a');
  });

  it('disposer removes the painter', () => {
    const custom: NodeShapeEntry = { id: 'temp', matches: () => true, paint: () => [] };
    const dispose = registerNodeShape(custom, { priority: 'high' });
    expect(findNodeShape(node({}))?.id).toBe('temp');
    dispose();
    expect(findNodeShape(node({}))?.id).toBe('kit:rect-fallback');
  });

  it('disposing twice is a no-op', () => {
    const custom: NodeShapeEntry = { id: 'once', matches: () => true, paint: () => [] };
    const dispose = registerNodeShape(custom, { priority: 'high' });
    dispose();
    dispose();
    expect(nodeShapeEntries().map((p) => p.id)).not.toContain('once');
  });

  it('a second dispose leaves another registration of the same painter in place', () => {
    const shared: NodeShapeEntry = { id: 'shared', matches: () => true, paint: () => [] };
    const first = registerNodeShape(shared, { priority: 'high' });
    registerNodeShape(shared, { priority: 'high' });
    first();
    first();
    expect(findNodeShape(node({}))?.id).toBe('shared');
  });

  it('a disposer takes out its own registration, not an earlier one of the same painter', () => {
    const p: NodeShapeEntry = { id: 'p', matches: (n) => (n.data as { k?: string }).k !== undefined, paint: () => [] };
    const q: NodeShapeEntry = { id: 'q', matches: () => true, paint: () => [] };
    registerNodeShape(p, { priority: 'high' });
    registerNodeShape(q, { priority: 'high' });
    const second = registerNodeShape(p, { priority: 'high' });
    second();
    expect(findNodeShape(node({ k: 'x' }))?.id).toBe('p');
  });
});

describe('findShapeSilhouette rotation', () => {
  function poseNode(pose: object): Node<{ shade: string }, 'default', object> {
    return { id: 'n', kind: 'mark', layer: 'default', pose, data: { shade: '#abc' }, parent: null } as never;
  }

  it('returns the unrotated silhouette for a pose with no rotation', () => {
    const sil = findShapeSilhouette(poseNode({ x: 0, y: 0, width: 20, height: 10 }), { x: 0, y: 0, width: 20, height: 10 });
    expect(sil).toEqual({ kind: 'rect', x: 0, y: 0, width: 20, height: 10 });
  });

  it('bakes pose.rotation into the silhouette — world coords, not the unrotated shape', () => {
    const pose = { x: 0, y: 0, width: 20, height: 10, rotation: Math.PI / 2 };
    const sil = findShapeSilhouette(poseNode(pose), pose) as PolygonPath;
    expect(sil.kind).toBe('polygon');
    // Corner (0,0) rotated 90° about center (10,5) lands at (15,-5).
    expect(sil.coords[0]).toBeCloseTo(15);
    expect(sil.coords[1]).toBeCloseTo(-5);
  });
});

describe('shapeCoversPoint', () => {
  it('narrows a pose rect to the painted shape', () => {
    // An ellipse inscribed in its pose: the pose corner is inside the rect but
    // outside the drawn shape.
    const pose = { x: 0, y: 0, width: 100, height: 100 };
    const n = { ...node({ shape: 'ellipse', fill: { paint: solid('#000') } }), pose };
    expect(shapeCoversPoint(n, pose, 50, 50)).toBe(true);
    expect(shapeCoversPoint(n, pose, 2, 2)).toBe(false);
  });

  it('covers the inside of a filled open path, and only the line of an unfilled one', () => {
    const path = pathFromD('M0 0 L100 0 L100 100');
    const pose = { x: 0, y: 0, width: 100, height: 100 };
    const filled = { ...node({ path, fill: { paint: solid('#f00') }, stroke: null }), pose };
    expect(shapeCoversPoint(filled, pose, 75, 25)).toBe(true);
    expect(shapeCoversPoint(filled, pose, 25, 75)).toBe(false);
    const line = { ...node({ path, fill: null, stroke: solidStroke('#000', 2) }), pose };
    expect(shapeCoversPoint(line, pose, 75, 25)).toBe(false);
    expect(shapeCoversPoint(line, pose, 50, 0)).toBe(true);
  });
});

describe('data.stroke is a whole Stroke', () => {
  const pose = { x: 0, y: 0, width: 100, height: 100 };
  const RECT = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
  const strokeCmdOf = (data: unknown): unknown => {
    const n = { ...node(data), pose };
    const [cmd] = findNodeShape(n)!.paint(n, pose);
    return (cmd as { stroke?: unknown }).stroke;
  };

  it('carries cap, join, dash and miter limit that the color form cannot express', () => {
    const stroke = {
      paint: { color: '#0f0' }, width: 12, cap: 'round', join: 'bevel',
      dash: [8, 4], miterLimit: 2,
    };
    expect(strokeCmdOf({ path: RECT, fill: null, stroke })).toEqual(stroke);
  });

  it('reaches kit:shape the same way', () => {
    const stroke = { paint: { color: '#0f0' }, width: 4, dash: [2, 2] };
    expect(strokeCmdOf({ shape: 'ellipse', fill: { paint: solid('#fff') }, stroke })).toEqual(stroke);
  });

  it('bakes a bounds-relative stroke gradient onto the pose box, as a fill is baked', () => {
    // Left unbaked, the paint would reach the renderer in `'bounds'` fractions
    // describing a frame that no longer exists — the pose is already in the path.
    const paint = {
      kind: 'linear-gradient' as const,
      from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
      units: 'bounds' as const,
    };
    const out = strokeCmdOf({ path: RECT, fill: null, stroke: { paint, width: 6 } }) as {
      paint: { units: string; from: { x: number }; to: { x: number } };
    };
    expect(out.paint.units).toBe('local');
    expect(out.paint.to.x).toBe(100);
  });

  it('skips a null stroke on kit:shape, the same as kit:path does', () => {
    expect(strokeCmdOf({ shape: 'rect', fill: { paint: solid('#fff') }, stroke: null })).toBeUndefined();
    expect(strokeCmdOf({ path: RECT, fill: { paint: solid('#fff') }, stroke: null })).toBeUndefined();
  });
});

describe('kit:rect-fallback resolves its fill for the renderer', () => {
  it('bakes a bounds-relative gradient onto the pose box, as kit:shape does', () => {
    const pose = { x: 10, y: 0, width: 100, height: 100 };
    const fill = {
      kind: 'linear-gradient' as const,
      from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
      units: 'bounds' as const,
    };
    const n = { ...node({ fill: { paint: fill } }), pose };
    const shape = findNodeShape(n)!;
    expect(shape.id).toBe('kit:rect-fallback');
    const [cmd] = shape.paint(n, pose) as { fill: { paint: { units: string; to: { x: number } } } }[];
    expect(cmd.fill.paint.units).toBe('local');
    expect(cmd.fill.paint.to.x).toBe(110);
  });
});

describe('kit:rect-fallback leaves containers alone', () => {
  const container = <TData>(data: TData) =>
    ({ ...node(data), kind: 'group', children: [], pose: { x: 0, y: 0, width: 10, height: 10 } }) as never;

  it('paints no box behind a group and gives it no silhouette to clip by', () => {
    expect(findNodeShape(container({}))).toBeUndefined();
    expect(findShapeSilhouette(container({}), { x: 0, y: 0, width: 10, height: 10 })).toBeNull();
  });
});

describe('built-in painters need a rect pose', () => {
  const circleNode = <TData>(data: TData) =>
    ({ id: 'c', kind: 'mark', layer: 'default', pose: { cx: 0, cy: 0, r: 5 }, data, parent: null }) as never;

  it('does not hand a circle-posed shape node to the shape painter', () => {
    expect(findNodeShape(circleNode({ shape: 'ellipse' }))?.id).not.toBe('kit:shape');
  });

  it('does not fall back to the rect painter for a circle', () => {
    expect(findNodeShape(circleNode({}))).toBeUndefined();
  });

  it('re-matches when the same data gets a different kind of pose', () => {
    const data = { shape: 'ellipse' };
    expect(findNodeShape(node(data))?.id).toBe('kit:shape');
    expect(findNodeShape(circleNode(data))?.id).not.toBe('kit:shape');
  });
});
