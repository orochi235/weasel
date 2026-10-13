// What stopping and starting an animation costs with N running: each frame cancels 100 tweens
// and starts 100 again, timing the cancels, the starts, the frame after them, and the frame
// after that one apart.
// Run through `node tests/perf/target-reads/run.mjs churn <N>... [keyed | stop]`. `keyed` runs
// each tween under a cancel key of its own and cancels by key; `stop` cancels through
// `target.stop()`. Both go by what is on the key or the target, not by a handle.
import { createAnimatorCore } from '../../../packages/animator/src/engine/core';
import { createTarget } from '../../../packages/animator/src/target';

const N = Number(process.env.N ?? 10000);
const CHURN = 100;
const WARM = 50;
const FRAMES = 300;
const MODE = process.argv[2] ?? 'handle';

let now = 0;
const core = createAnimatorCore({
  now: () => now,
  requestFrame: () => {},
  cancelFrame: () => {},
  tripwire: () => false,
  colorOverrides: {} as never,
});
const committed = new Float64Array(N * 2);
const targets = Array.from({ length: N }, (_, row) => createTarget<number[]>({
  get: () => [committed[row * 2]!, committed[row * 2 + 1]!],
  set: (v) => { committed[row * 2] = v[0]!; committed[row * 2 + 1] = v[1]!; },
}));
const handles: { cancel(): void }[] = [];
const start = (row: number): void => {
  handles[row] = core.api.tween<number[]>({
    target: targets[row]!, to: [500 + row, 100 + row], ms: 1e9,
    cancelKey: MODE === 'keyed' ? `row:${row}` : undefined,
  });
};
const cancel = (row: number): void => {
  if (MODE === 'keyed') core.api.cancelKey(`row:${row}`);
  else if (MODE === 'stop') targets[row]!.stop();
  else handles[row]!.cancel();
};
const frame = (): void => { now += 16; core.tick(now); };

for (let row = 0; row < N; row++) start(row);
for (let i = 0; i < WARM; i++) frame();
const t0 = performance.now();
for (let i = 0; i < FRAMES; i++) frame();
const steady = (performance.now() - t0) / FRAMES;

let next = 0;
let canceling = 0;
let starting = 0;
let first = 0;
let second = 0;
for (let f = 0; f < WARM + FRAMES; f++) {
  const a = performance.now();
  for (let i = 0; i < CHURN; i++) cancel((next + i) % N);
  const b = performance.now();
  for (let i = 0; i < CHURN; i++) start((next + i) % N);
  const c = performance.now();
  frame();
  const d = performance.now();
  frame();
  const e = performance.now();
  next = (next + CHURN) % N;
  if (f < WARM) continue;
  canceling += b - a;
  starting += c - b;
  first += d - c;
  second += e - d;
}
const us = (t: number): string => ((t * 1000) / (FRAMES * CHURN)).toFixed(2).padStart(6);
const ms = (t: number): string => t.toFixed(3).padStart(7);
process.stdout.write(
  `${String(N).padStart(7)} running, ${CHURN} restarted a frame${MODE === 'handle' ? '' : ` (${MODE})`}:  cancel ${us(canceling)} us each  start ${us(starting)} us each`
  + `  frame ${ms(first / FRAMES)} ms  the one after ${ms(second / FRAMES)} ms  steady ${ms(steady)} ms\n`,
);
