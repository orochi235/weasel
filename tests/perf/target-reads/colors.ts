// A frame of N nodes' vertex colors, each tweening, every one resolved the way a painter does.
// Run through `node tests/perf/target-reads/run.mjs colors <N>...`.
import { ColorOverrideRegistry } from '../../../packages/animator/src/colorRegistry';
import { createAnimatorCore } from '../../../packages/animator/src/engine/core';

const N = Number(process.env.N ?? 1000);
/** Numbers a node: four anchors of RGBA. */
const LENGTH = 16;
const FRAMES = Math.max(20, Math.round(2e6 / N));

function time(registry: ColorOverrideRegistry, resolve: boolean): number {
  let now = 0;
  const core = createAnimatorCore({
    now: () => now,
    requestFrame: () => {},
    cancelFrame: () => {},
    tripwire: () => false,
    colorOverrides: registry,
  });
  const ids = Array.from({ length: N }, (_, i) => `n${i}`);
  const to = new Array<number>(LENGTH).fill(1);
  for (const id of ids) core.api.tween({ target: registry.target(id, 'fill', LENGTH), to, ms: 1e9 });
  let sum = 0;
  const frame = (): void => {
    now += 16;
    core.tick(now);
    if (resolve) for (const id of ids) sum += registry.resolve(id, 'fill', undefined, now)![0]!;
  };
  for (let i = 0; i < 20; i++) frame();
  const t0 = performance.now();
  for (let i = 0; i < FRAMES; i++) frame();
  const ns = ((performance.now() - t0) * 1e6) / (FRAMES * N);
  if (!Number.isFinite(sum)) throw new Error('colors: a resolve answered no number');
  return ns;
}

const idle = time(new ColorOverrideRegistry(), false);
const read = time(new ColorOverrideRegistry(), true);
process.stdout.write(`${String(N).padStart(6)} nodes  frame ${idle.toFixed(1).padStart(6)} ns/node  with resolve ${read.toFixed(1).padStart(6)} ns/node  resolve ${(read - idle).toFixed(1).padStart(6)} ns/node\n`);
