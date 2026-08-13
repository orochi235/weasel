/**
 * Area hit-testing against node count and query-rect size.
 *
 * There is no quadtree. `hitTestArea` — the marquee and lasso dep source —
 * is a linear scan over `scene.renderOrder()` with an AABB fast-reject, and
 * for path-shaped poses a per-node silhouette-vs-area polygon kernel that is
 * O(silhouette verts x area verts). So node count is the axis that matters
 * for rect poses, and query-rect size only matters through how many nodes
 * survive the fast-reject and reach the kernel.
 *
 * These numbers are the argument for or against building an index. They are
 * not a benchmark of one.
 */
import { bench, describe } from 'vitest';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import { aabbOfPose } from 'canvas/SceneCanvas/poseGeometry';
import type { Scene } from 'core/scene/types';
import { pointInPath } from 'features/paths/hitTest';
import { curvyPath, polygonPath, scatterScene } from './fixtures';

const NODE_COUNTS = [100, 1000, 10000];
const SPAN = 4000;

// Query rects as a fraction of the populated world, all centered. The 100%
// case is "select all" — every node reaches the kernel.
const RECTS = [
  { label: '1% area', f: 0.1 },
  { label: '25% area', f: 0.5 },
  { label: '100% area', f: 1 },
];

function rectFor(f: number) {
  const size = SPAN * f;
  const off = (SPAN - size) / 2;
  return { x: off, y: off, width: size, height: size };
}

const rectScenes = new Map(NODE_COUNTS.map((n) => [n, scatterScene(n, { shape: 'rect' })]));
const polyScenes = new Map(
  NODE_COUNTS.map((n) => [n, scatterScene(n, { shape: 'polygon', sides: 24 })]),
);

const asAny = (s: unknown) => s as Scene<unknown, string, unknown>;

describe('hitTestArea — rect poses, node count (25% query rect)', () => {
  const bounds = rectFor(0.5);
  for (const n of NODE_COUNTS) {
    const scene = asAny(rectScenes.get(n));
    bench(`${n} nodes`, () => {
      hitTestArea(scene, bounds);
    });
  }
});

describe('hitTestArea — rect poses, query-rect size (1000 nodes)', () => {
  const scene = asAny(rectScenes.get(1000));
  for (const { label, f } of RECTS) {
    const bounds = rectFor(f);
    // Hit count in the label so a flat curve across this axis reads as "the
    // scan does the same work regardless", not as "the fixture never varied".
    const hits = hitTestArea(scene, bounds).length;
    bench(`${label} (${hits} hits)`, () => {
      hitTestArea(scene, bounds);
    });
  }
});

describe('hitTestArea — 24-gon silhouettes, node count (25% query rect)', () => {
  const bounds = rectFor(0.5);
  for (const n of NODE_COUNTS) {
    const scene = asAny(polyScenes.get(n));
    bench(`${n} nodes`, () => {
      hitTestArea(scene, bounds);
    });
  }
});

describe('hitTestArea — 24-gon silhouettes, query-rect size (1000 nodes)', () => {
  const scene = asAny(polyScenes.get(1000));
  for (const { label, f } of RECTS) {
    const bounds = rectFor(f);
    const hits = hitTestArea(scene, bounds).length;
    bench(`${label} (${hits} hits)`, () => {
      hitTestArea(scene, bounds);
    });
  }
});

describe('aabbOfPose — the per-node fast-reject itself', () => {
  // Why query-rect size barely moves the silhouette numbers above: the
  // fast-reject calls `boundsOfPath`, which walks the whole command stream
  // and allocates, for every node in the scene whether or not it can
  // possibly intersect. A rejected path node costs its own vertex count.
  const rect = { x: 0, y: 0, width: 40, height: 40 };
  bench('rect pose', () => {
    aabbOfPose(rect);
  });
  for (const sides of [4, 24, 256]) {
    const path = polygonPath(sides, 20, 0, 0);
    bench(`${sides}-gon pose`, () => {
      aabbOfPose(path);
    });
  }
});

describe('pointInPath — per-node kernel, by vertex count', () => {
  // The point-pick path (`poseContains`) reaches this once per candidate.
  for (const sides of [4, 24, 256]) {
    const path = polygonPath(sides, 100, 0, 0);
    bench(`${sides}-gon`, () => {
      pointInPath(path, 10, 10);
    });
  }
  for (const curves of [8, 64]) {
    const path = curvyPath(curves);
    bench(`${curves} cubics (flattened per call)`, () => {
      pointInPath(path, 10, 10);
    });
  }
});
