/**
 * The unindexed area walk of `walk.bench.ts` (the `full walk` row: the 25% marquee over 10,000 rect
 * nodes, no pick index) and the scene round trip of `../scene-roundtrip-2026-10-29/roundtrip.mjs`,
 * timed in one process. Run from the repo root under tests/perf/bench/node-hooks.mjs; prints one
 * JSON record. Batch medians, as roundtrip.mjs takes them.
 */
import * as area from 'canvas/deps/hitTestArea';
import * as walk from 'canvas/pickWalk';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize';
import { rectRegion } from 'core/geometry/regionHit';
import { scatterScene } from '../../bench/fixtures.ts';

const BATCHES = Number(process.env.BATCHES ?? 200);
const WARM_MS = Number(process.env.WARM_MS ?? 1500);
const SPAN = 4000;
const rect = { x: SPAN / 4, y: SPAN / 4, width: SPAN / 2, height: SPAN / 2 };
const scene = scatterScene(10000, { shape: 'rect' });
const q = area.regionPickQuery(rectRegion(rect), 'intersect', AUTO_POSE_DESCRIPTOR, {});

let sink = 0;
const body = () => { sink += walk.pickWalk(walk.scenePickSource(scene), q).length; };
const end = performance.now() + WARM_MS;
while (performance.now() < end) body();
const per = [];
for (let b = 0; b < BATCHES; b++) {
  const t0 = process.hrtime.bigint();
  body();
  per.push(Number(process.hrtime.bigint() - t0) / 1e6);
}
per.sort((a, b) => a - b);
console.log(JSON.stringify({
  label: process.env.LABEL ?? null, hits: walk.pickWalk(walk.scenePickSource(scene), q).length,
  fullWalkMs: { median: per[per.length >> 1], min: per[0], p90: per[Math.floor(per.length * 0.9)] },
}));
