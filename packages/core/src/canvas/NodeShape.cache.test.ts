/**
 * The per-node painter/silhouette cache and, more importantly, when it lets go.
 *
 * A stale silhouette is a silent picking bug — the shape moves and the click
 * target stays behind — so the invalidation conditions matter more than the
 * hit rate. The cache rests on the scene mutating node objects in place while
 * *replacing* `pose` and `data` with new references, which is what the
 * `kit:setPose` / `kit:setData` ops do.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  findNodeShape,
  findShapeSilhouette,
  registerNodeShape,
  _resetShapePaintersForTests,
  type NodeShapeEntry,
} from './NodeShape';
import type { Node } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { PathDrawCommand } from '../renderer';
import { PATH_M, PATH_L, PATH_Z } from 'features/paths/types';
import { solid } from '../util/paint';

interface RectPose { x: number; y: number; width: number; height: number }

afterEach(() => {
  _resetShapePaintersForTests();
});

/** A node whose `pose` / `data` can be swapped the way the scene ops do:
 *  same object, new field references. */
function makeNode(data: unknown, pose: RectPose): Node<unknown, string, RectPose> {
  return {
    id: asNodeId('n'), kind: 'leaf', layer: 'main', pose, data,
  } as unknown as Node<unknown, string, RectPose>;
}

const ELLIPSE = { shape: 'ellipse' };
const POSE: RectPose = { x: 0, y: 0, width: 100, height: 60 };

describe('silhouette caching', () => {
  it('returns an identical path for repeated calls with the same pose', () => {
    const node = makeNode(ELLIPSE, POSE);
    const a = findShapeSilhouette(node, node.pose);
    const b = findShapeSilhouette(node, node.pose);
    // Same object, not merely an equal one — the point is that the second
    // call allocated nothing.
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });

  it('rebuilds when the pose reference changes', () => {
    const node = makeNode(ELLIPSE, POSE);
    const before = findShapeSilhouette(node, node.pose);
    (node as { pose: RectPose }).pose = { x: 500, y: 500, width: 100, height: 60 };
    const after = findShapeSilhouette(node, node.pose);
    expect(after).not.toBe(before);
    // And it describes the new position, not the old one.
    const coords = (after as { coords: Float32Array }).coords;
    expect(Math.min(...coords)).toBeGreaterThan(400);
  });

  it('rebuilds when the data reference changes', () => {
    // A star's silhouette depends on `points`, which lives in data, not pose.
    const node = makeNode({ shape: 'star', points: 5 }, POSE);
    const five = findShapeSilhouette(node, node.pose) as { commands: Uint8Array };
    (node as { data: unknown }).data = { shape: 'star', points: 9 };
    const nine = findShapeSilhouette(node, node.pose) as { commands: Uint8Array };
    expect(nine.commands.length).toBeGreaterThan(five.commands.length);
  });

  it('does not cache a preview pose over the node\'s own', () => {
    // Mid-drag the caller passes a ghost pose. That must not become the
    // answer for the node's real pose afterwards.
    const node = makeNode(ELLIPSE, POSE);
    const real = findShapeSilhouette(node, node.pose);
    const ghost = findShapeSilhouette(node, { x: 900, y: 900, width: 100, height: 60 });
    expect(ghost).not.toBe(real);
    const realAgain = findShapeSilhouette(node, node.pose);
    const coords = (realAgain as { coords: Float32Array }).coords;
    expect(Math.max(...coords)).toBeLessThan(400);
  });

  it('keeps separate entries per node', () => {
    const a = makeNode(ELLIPSE, POSE);
    const b = makeNode(ELLIPSE, { x: 300, y: 0, width: 100, height: 60 });
    const silA = findShapeSilhouette(a, a.pose);
    const silB = findShapeSilhouette(b, b.pose);
    expect(silB).not.toBe(silA);
    // Re-reading A still gets A's.
    expect(findShapeSilhouette(a, a.pose)).toBe(silA);
  });
});

describe('paint caching', () => {
  // The point of caching `paint` is not the command objects — it is the `Path`
  // inside them. `renderer/cache/cache.ts` memoizes tessellation as
  // `WeakMap<Path, Mesh>`, keyed on Path *identity*, so it only ever pays off
  // if the same Path object comes back frame after frame. `pathForShape` and
  // the non-identity branch of `pathInPoseFrame` both allocate, which meant
  // that cache was consulted, missed and repopulated on every draw.
  function paintOf(node: Node<unknown, string, RectPose>, pose: RectPose): PathDrawCommand {
    const painter = findNodeShape(node);
    return painter!.paint(node, pose)[0] as PathDrawCommand;
  }

  it('kit:shape hands back the identical path object for an unchanged node', () => {
    const node = makeNode(ELLIPSE, POSE);
    const first = paintOf(node, node.pose);
    const second = paintOf(node, node.pose);
    expect(second.path).toBe(first.path);
  });

  it('kit:shape rebuilds the path when the pose reference changes', () => {
    const node = makeNode(ELLIPSE, POSE);
    const before = paintOf(node, node.pose);
    (node as { pose: RectPose }).pose = { x: 500, y: 500, width: 100, height: 60 };
    const after = paintOf(node, node.pose);
    expect(after.path).not.toBe(before.path);
    const coords = (after.path as { coords: Float32Array }).coords;
    expect(Math.min(...coords)).toBeGreaterThan(400);
  });

  it('kit:shape rebuilds when the data reference changes', () => {
    // Both the geometry (`points`) and the paint (`fill`) live in data.
    const node = makeNode({ shape: 'star', points: 5, fill: solid('#f00') }, POSE);
    const five = paintOf(node, node.pose);
    expect(five.fill).toEqual({ color: '#f00' });
    (node as { data: unknown }).data = { shape: 'star', points: 9, fill: solid('#0f0') };
    const nine = paintOf(node, node.pose);
    expect((nine.path as { commands: Uint8Array }).commands.length)
      .toBeGreaterThan((five.path as { commands: Uint8Array }).commands.length);
    expect(nine.fill).toEqual({ color: '#0f0' });
  });

  it('kit:path hands back the identical command for an unchanged node', () => {
    const path = { kind: 'polygon' as const, commands: new Uint8Array([PATH_M, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 10]), fillRule: 'nonzero' as const };
    const node = makeNode({ path, fill: solid('#00f') }, POSE);
    const first = paintOf(node, node.pose);
    const second = paintOf(node, node.pose);
    expect(second).toBe(first);
    expect(second.path).toBe(first.path);
  });

  it('does not memoize kit:image — its paint reads state the key cannot see', () => {
    // An async decode landing changes what `paint` returns with no change to
    // `data`, and `NodePaintCtx.resolveImage` (supplied by the headless
    // render path) is authoritative but absent from the key. Both make image
    // paint unsafe to cache under `(node, pose, data)`.
    const node = makeNode({ image: { src: 'x' } }, POSE);
    const painter = findNodeShape(node);
    expect(painter?.id).toBe('kit:image');
    const bmp = { width: 2, height: 2, close() {} } as unknown as ImageBitmap;
    const pending = painter!.paint(node, node.pose, { resolveImage: () => undefined });
    expect(pending[0].kind).toBe('path'); // placeholder outline
    const ready = painter!.paint(node, node.pose, { resolveImage: () => bmp });
    expect(ready[0]).toMatchObject({ kind: 'image', image: bmp });
  });

  it('memoizes kit:text, so its runs array stays stable frame to frame', () => {
    // Not for `paint`'s own cost — `resolveTextStyle` + `resolveRuns` are
    // pure style merging and measure 0.14 ms/frame at 1000 text nodes.
    // It is the enabler for the renderer's layout cache, which keys on the
    // `ResolvedRun[]` identity the way the mesh cache keys on `Path`
    // identity. `layoutRuns` is 25.9 ms/frame for 200 wrapped paragraphs, and
    // a fresh runs array per frame would leave that cache missing on every
    // draw. Same shape of win as `kit:shape`: memoizing a cheap thing to turn
    // an expensive cache on.
    const node = makeNode({ text: 'Hi' }, POSE);
    const painter = findNodeShape(node);
    expect(painter?.id).toBe('kit:text');
    const a = painter!.paint(node, node.pose)[0] as { runs: unknown };
    const b = painter!.paint(node, node.pose)[0] as { runs: unknown };
    expect(b).toBe(a);
    expect(b.runs).toBe(a.runs);
  });

  it('rebuilds kit:text when the text changes', () => {
    const node = makeNode({ text: 'Hi' }, POSE);
    const before = findNodeShape(node)!.paint(node, node.pose)[0] as { runs: { text: string }[] };
    expect(before.runs[0].text).toBe('Hi');
    (node as { data: unknown }).data = { text: 'Bye' };
    const after = findNodeShape(node)!.paint(node, node.pose)[0] as { runs: { text: string }[] };
    expect(after.runs[0].text).toBe('Bye');
  });
});

describe('painter caching', () => {
  it('does not re-run matches predicates for an unchanged node', () => {
    const matches = vi.fn(() => false);
    registerNodeShape({ id: 'test:never', matches, paint: () => [] } as NodeShapeEntry, {
      priority: 'high',
    });
    const node = makeNode(ELLIPSE, POSE);
    findNodeShape(node);
    const afterFirst = matches.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    findNodeShape(node);
    findNodeShape(node);
    expect(matches.mock.calls.length).toBe(afterFirst);
  });

  it('re-runs matches when the node data changes', () => {
    const matches = vi.fn(() => false);
    registerNodeShape({ id: 'test:never', matches, paint: () => [] } as NodeShapeEntry, {
      priority: 'high',
    });
    const node = makeNode(ELLIPSE, POSE);
    findNodeShape(node);
    const afterFirst = matches.mock.calls.length;
    (node as { data: unknown }).data = { shape: 'star', points: 5 };
    findNodeShape(node);
    expect(matches.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('invalidates when a painter is registered after the fact', () => {
    const node = makeNode(ELLIPSE, POSE);
    expect(findNodeShape(node)?.id).toBe('kit:shape');
    const dispose = registerNodeShape(
      {
        id: 'test:override',
        matches: () => true,
        paint: () => [],
        silhouette: () => ({ kind: 'rect', x: 7, y: 7, width: 1, height: 1 }),
      } as NodeShapeEntry,
      { priority: 'high' },
    );
    // A cache keyed only on (pose, data) would still be answering 'kit:shape'.
    expect(findNodeShape(node)?.id).toBe('test:override');
    expect(findShapeSilhouette(node, node.pose)).toMatchObject({ x: 7, y: 7 });
    dispose();
    expect(findNodeShape(node)?.id).toBe('kit:shape');
  });
});
