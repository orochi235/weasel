/**
 * The 25% marquee on the 10,000-node rect scatter, written against only what
 * every measured commit has, so one file times each of them. `run.sh` copies
 * it into each commit's `tests/perf/bench/` before running it there.
 */
import * as area from 'canvas/deps/hitTestArea';
import * as walk from 'canvas/pickWalk';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize';
import { rectRegion } from 'core/geometry/regionHit';
import type { Scene } from 'core/scene/types';
import { group } from './group';
import { scatterScene } from './fixtures';

const SPAN = 4000;
const rect = { x: SPAN / 4, y: SPAN / 4, width: SPAN / 2, height: SPAN / 2 };
const scene = scatterScene(10000, { shape: 'rect' }) as unknown as Scene<unknown, string, unknown>;

group('hitTestArea, 10000 rect nodes, 25% query rect', (bench) => {
  bench('hitTestArea', () => {
    area.hitTestArea(scene, rect);
  });
  // Only a commit with the pick index has these; there `hitTestArea` is indexed.
  const query = (area as Record<string, unknown>).regionPickQuery as
    | ((...args: unknown[]) => walk.PickQuery<unknown>)
    | undefined;
  if (query) {
    const q = query(rectRegion(rect), 'intersect', AUTO_POSE_DESCRIPTOR, {});
    bench('full walk', () => {
      walk.pickWalk(walk.scenePickSource(scene), q);
    });
  }
}, { time: 3000 });
