/**
 * One process's timing of scene.add + scene.remove and of scene.setPose, written against only
 * what every measured commit has. Run under that commit's tests/perf/bench/node-hooks.mjs;
 * prints one JSON record. Batch medians, not a mean: GC pauses land in a few batches.
 */
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import * as frame from 'core/scene/composeFrame';

const BATCH = 1000;
const BATCHES = Number(process.env.BATCHES ?? 200);
const WARM = 20000;
const POSE = { x: 1, y: 2, width: 3, height: 4 };

function scene() {
  let i = 0;
  return createScene({
    ...(frame.IDENTITY_POSE_COMPOSITION ? { composition: frame.IDENTITY_POSE_COMPOSITION } : {}),
    systemLayers: [{ id: 'main' }],
    historyLimit: 2,
    generateId: () => asNodeId(`b${(i++).toString(36)}`),
  });
}

function time(body) {
  for (let i = 0; i < WARM; i++) body();
  const per = [];
  for (let b = 0; b < BATCHES; b++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < BATCH; i++) body();
    per.push(Number(process.hrtime.bigint() - t0) / BATCH);
  }
  per.sort((a, b) => a - b);
  return { median: per[per.length >> 1], min: per[0], p90: per[Math.floor(per.length * 0.9)] };
}

const rt = scene();
const roundTrip = time(() => {
  const id = rt.add({ kind: 'mark', layer: 'main', pose: POSE, data: { n: 0 } });
  rt.remove(id);
});
const sp = scene();
const id = sp.add({ kind: 'mark', layer: 'main', pose: POSE, data: { n: 0 } });
let x = 0;
const setPose = time(() => sp.setPose(id, { x: x++, y: 0, width: 3, height: 4 }));
console.log(JSON.stringify({ label: process.env.LABEL ?? null, roundTripNs: roundTrip, setPoseNs: setPose }));
