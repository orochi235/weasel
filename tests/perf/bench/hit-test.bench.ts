/**
 * Area hit-testing against node count and query-rect size.
 *
 * `hitTestArea` asks the scene's BVH pick index for the nodes the query's box
 * can reach, then runs the per-node kernel (O(silhouette verts x area verts)
 * for path-shaped poses) on those alone. The "full walk" groups run the same
 * query through `pickWalk` with no index, which visits every node. The index
 * builds on the second pick to find the scene unchanged, so the first pick of
 * every bench below walks; vitest's warmup absorbs it.
 */
import { group } from './group';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import { regionPickQuery } from 'canvas/deps/hitTestArea';
import { pickWalk, scenePickSource } from 'canvas/pickWalk';
import { scenePickIndex } from 'canvas/pickIndex/scenePickIndex';
import { scenePointQuery } from 'canvas/SceneCanvas/scenePointQuery';
import { aabbOfPose } from 'canvas/SceneCanvas/poseGeometry';
import type { Scene } from 'core/scene/types';
import { pointInPath } from '@weasel-js/geom';
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

group('hitTestArea — rect poses, node count (25% query rect)', (bench) => {
  const bounds = rectFor(0.5);
  for (const n of NODE_COUNTS) {
    const scene = asAny(rectScenes.get(n));
    bench(`${n} nodes`, () => {
      hitTestArea(scene, bounds);
    });
  }
});

group('hitTestArea — rect poses, query-rect size (1000 nodes)', (bench) => {
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

group('hitTestArea — 24-gon silhouettes, node count (25% query rect)', (bench) => {
  const bounds = rectFor(0.5);
  for (const n of NODE_COUNTS) {
    const scene = asAny(polyScenes.get(n));
    bench(`${n} nodes`, () => {
      hitTestArea(scene, bounds);
    });
  }
});

group('hitTestArea — 24-gon silhouettes, query-rect size (1000 nodes)', (bench) => {
  const scene = asAny(polyScenes.get(1000));
  for (const { label, f } of RECTS) {
    const bounds = rectFor(f);
    const hits = hitTestArea(scene, bounds).length;
    bench(`${label} (${hits} hits)`, () => {
      hitTestArea(scene, bounds);
    });
  }
});

group('aabbOfPose — the per-node fast-reject itself', (bench) => {
  // Why query-rect size barely moves the silhouette numbers above: the
  // fast-reject walks a path pose's whole command stream, so a rejected
  // path node costs its own vertex count.
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

group('pointInPath — per-node kernel, by vertex count', (bench) => {
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

const areaQuery = (f: number) => regionPickQuery(rectRegion(rectFor(f)), 'intersect', AUTO_POSE_DESCRIPTOR, {});

group('area pick — BVH index vs full walk, node count (1% query rect)', (bench) => {
  const query = areaQuery(0.1);
  for (const n of NODE_COUNTS) {
    const scene = asAny(rectScenes.get(n));
    bench(`indexed, ${n} nodes`, () => {
      pickWalk(scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } }), query);
    });
    bench(`full walk, ${n} nodes`, () => {
      pickWalk(scenePickSource(scene), query);
    });
  }
});

group('area pick — BVH index vs full walk, 10000 nodes by query-rect size', (bench) => {
  const scene = asAny(rectScenes.get(10000));
  for (const { label, f } of RECTS) {
    const query = areaQuery(f);
    bench(`indexed, ${label}`, () => {
      pickWalk(scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } }), query);
    });
    bench(`full walk, ${label}`, () => {
      pickWalk(scenePickSource(scene), query);
    });
  }
});

group('point pick — BVH index vs full walk, node count', (bench) => {
  const query = scenePointQuery<unknown>(AUTO_POSE_DESCRIPTOR, true, 4)(SPAN / 2, SPAN / 2, { x: 1, y: 1 });
  for (const n of NODE_COUNTS) {
    const scene = asAny(rectScenes.get(n));
    bench(`indexed, ${n} nodes`, () => {
      pickWalk(scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } }), query);
    });
    bench(`full walk, ${n} nodes`, () => {
      pickWalk(scenePickSource(scene), query);
    });
  }
});

group('pick index — rebuild after one pose change, node count', (bench) => {
  for (const n of NODE_COUNTS) {
    const scene = scatterScene(n, { shape: 'rect' });
    const id = scene.renderOrder()[0];
    let i = 0;
    bench(`${n} nodes`, () => {
      scene.setPose(id, { x: i++ % 100, y: 0, width: 40, height: 40 });
      // The first pick after a change only records it; the second builds.
      scenePickIndex(asAny(scene), AUTO_POSE_DESCRIPTOR);
      scenePickIndex(asAny(scene), AUTO_POSE_DESCRIPTOR);
    });
  }
});

group('area pick after every pose change (25% query rect), 10000 nodes', (bench) => {
  // An animation's case: the indexed pick walks, since the scene is never still twice.
  const query = areaQuery(0.5);
  for (const indexed of [true, false]) {
    const scene = scatterScene(10000, { shape: 'rect' });
    const id = scene.renderOrder()[0];
    const src = () => scenePickSource(asAny(scene), indexed ? { index: { descriptor: AUTO_POSE_DESCRIPTOR } } : {});
    let i = 0;
    bench(indexed ? 'indexed' : 'full walk', () => {
      scene.setPose(id, { x: i++ % 100, y: 0, width: 40, height: 40 });
      pickWalk(src(), query);
    });
  }
});
