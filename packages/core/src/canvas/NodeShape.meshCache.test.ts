/**
 * Does memoizing `paint` actually turn the tessellation cache on?
 *
 * `renderer/cache/cache.ts` memoizes tessellation as `WeakMap<Path, Mesh>`,
 * keyed on **`Path` object identity**. That only pays off if the same `Path`
 * object is handed back frame after frame — and before `kit:shape` and
 * `kit:path` memoized their `paint`, it wasn't: `pathForShape` built a fresh
 * `Uint8Array` + `Float32Array` for every ellipse, polygon and star, every
 * frame. So the cache was allocated, consulted, missed and repopulated on
 * every draw, for the whole shape family the kit ships.
 *
 * The measurement below counts **distinct `Mesh` objects** produced by driving
 * `getMesh` with each frame's paint output. One mesh per node means every
 * frame after the first was a cache hit; N×frames means every frame missed.
 *
 * The control arm is the pre-memo painter, running side by side — so the
 * regression this guards against isn't a historical red, it's the number in
 * the other column.
 */
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { defaultDrawOne } from './defaultDrawOne';
import { registerNodeShape, _resetShapePaintersForTests } from './NodeShape';
import { getMesh, _resetCacheForTests } from '../renderer/cache/cache';
import type { Mesh } from '../renderer/cache/mesh';
import type { PathDrawCommand } from '../renderer';
import type { Node } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { ellipsePath, regularPolygonPath, starPath } from 'features/paths/builder';

interface RectPose { x: number; y: number; width: number; height: number }

const NODE_COUNT = 200;
const FRAMES = 5;

beforeEach(() => {
  _resetCacheForTests();
});

afterEach(() => {
  _resetShapePaintersForTests();
  _resetCacheForTests();
});

/** A scene of non-rect shapes — rects are excluded because solid-fill rect
 *  paths bypass the mesh cache entirely via `drawRectFast`. */
function buildScene(): Node<unknown, string, RectPose>[] {
  const kinds = ['ellipse', 'polygon', 'star'];
  return Array.from({ length: NODE_COUNT }, (_, i) => ({
    id: asNodeId(`n${i}`),
    kind: 'leaf',
    layer: 'main',
    pose: { x: i * 7, y: i * 3, width: 40, height: 30 },
    data: { shape: kinds[i % kinds.length], sides: 6, points: 5, fill: '#abc' },
  })) as unknown as Node<unknown, string, RectPose>[];
}

/** Draw every node for `FRAMES` frames, pushing each emitted path through the
 *  renderer's mesh cache exactly as `fillMeshHandle` does. Returns how many
 *  distinct meshes the cache had to build. */
function meshesBuiltOver(nodes: Node<unknown, string, RectPose>[]): number {
  const seen = new Set<Mesh>();
  for (let frame = 0; frame < FRAMES; frame++) {
    for (const node of nodes) {
      for (const cmd of defaultDrawOne(node, node.pose)) {
        if (cmd.kind !== 'path') continue;
        seen.add(getMesh((cmd as PathDrawCommand).path));
      }
    }
  }
  return seen.size;
}

/** The `kit:shape` painter as it was before the memo: rebuilds its path on
 *  every call. Registered at `'high'` so it wins over the real one. */
function registerUnmemoizedShapePainter(): void {
  registerNodeShape(
    {
      id: 'test:shape-unmemoized',
      matches: (node) => (node.data as { shape?: string } | null)?.shape != null,
      paint: (node, pose) => {
        const d = node.data as { shape: string; sides?: number; points?: number; fill?: string };
        const p = pose as RectPose;
        const cx = p.x + p.width / 2;
        const cy = p.y + p.height / 2;
        const r = Math.min(p.width, p.height) / 2;
        const path =
          d.shape === 'ellipse' ? ellipsePath(p)
          : d.shape === 'polygon' ? regularPolygonPath({ x: cx, y: cy }, r, d.sides ?? 6)
          : starPath({ x: cx, y: cy }, r, d.points ?? 5);
        return [{ kind: 'path', path, fill: { color: d.fill ?? '#888' } }];
      },
    },
    { priority: 'high' },
  );
}

describe('mesh cache hit rate', () => {
  it('builds one mesh per node across many frames', () => {
    // The memoized painters hand back the same `Path` object every frame, so
    // `WeakMap<Path, Mesh>` hits on frames 2..N — a 1/FRAMES tessellation load.
    expect(meshesBuiltOver(buildScene())).toBe(NODE_COUNT);
  });

  it('control: the pre-memo painter rebuilds every mesh, every frame', () => {
    // Same scene, same shapes, same frames — the only difference is that this
    // painter allocates a fresh `Path` per call. This is the number the kit
    // was paying before, and what this test exists to keep it from paying
    // again.
    registerUnmemoizedShapePainter();
    expect(meshesBuiltOver(buildScene())).toBe(NODE_COUNT * FRAMES);
  });

  it('still rebuilds when a node actually moves', () => {
    // The cache must not be *too* sticky: a real pose change has to produce
    // new geometry, or shapes freeze in place mid-drag.
    const nodes = buildScene().slice(0, 1);
    const seen = new Set<Mesh>();
    for (let frame = 0; frame < FRAMES; frame++) {
      (nodes[0] as { pose: RectPose }).pose = { x: frame * 10, y: 0, width: 40, height: 30 };
      for (const cmd of defaultDrawOne(nodes[0], nodes[0].pose)) {
        if (cmd.kind === 'path') seen.add(getMesh((cmd as PathDrawCommand).path));
      }
    }
    expect(seen.size).toBe(FRAMES);
  });
});
