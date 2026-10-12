// A minimal target table over the real animator core, timed against per-target reads.
// N rows of [x, y], every one moving. Run through `node tests/perf/target-reads/run.mjs`.
import { createAnimatorCore } from '../../../packages/core/src/animation/engine/core';
import { createTarget, stateOf } from '../../../packages/core/src/animation/target';

const N = Number(process.env.N ?? 10000);
const AXES = 2;

let now = 0;
const core = createAnimatorCore({
  now: () => now,
  requestFrame: () => {},
  cancelFrame: () => {},
  tripwire: () => false,
  colorOverrides: {} as never,
});

// The table: resting values and on-screen values, each one flat array.
const committed = new Float64Array(N * AXES);
const shown = new Float64Array(N * AXES);
const targets = Array.from({ length: N }, (_, row) => createTarget<number[]>({
  get: () => [committed[row * AXES]!, committed[row * AXES + 1]!],
  set: (v) => { committed[row * AXES] = v[0]!; committed[row * AXES + 1] = v[1]!; },
}));
for (let row = 0; row < N; row++) core.api.tween<number[]>({ target: targets[row]!, to: [500, 100 + row], ms: 1e9 });
for (let f = 0; f < 5; f++) { now += 16; core.tick(now); }
const states = targets.map((t) => stateOf(t));

/** Today: one readInto per target. */
const perTarget = (): void => { for (let row = 0; row < N; row++) targets[row]!.readInto(shown, row * AXES); };

/** A table that still reaches each row's state, slot, and adjust array. */
const viaState = (): void => {
  for (let row = 0; row < N; row++) {
    const s = states[row]!;
    const slot = s.slot!;
    const adjust = s.adjust;
    for (let k = 0; k < AXES; k++) {
      shown[row * AXES + k] = committed[row * AXES + k]! + slot.cols[slot.at + k]! + adjust[k]!;
    }
  }
};

// A table that keeps where each row's offsets are, and its adjustments, flat. What the engine
// would maintain as rows start and stop moving; here it is read off the states once.
const slotAt = Int32Array.from(states, (s) => s.slot!.at);
const cols = states[0]!.slot!.cols;
const adjustFlat = new Float64Array(N * AXES);
const flat = (): void => {
  for (let row = 0; row < N; row++) {
    const at = slotAt[row]!;
    for (let k = 0; k < AXES; k++) {
      shown[row * AXES + k] = committed[row * AXES + k]! + cols[at + k]! + adjustFlat[row * AXES + k]!;
    }
  }
};

// Every pass has to answer what a read answers.
const check = (label: string, fn: () => void): void => {
  shown.fill(NaN);
  fn();
  for (const row of [0, 1, N >> 1, N - 1]) {
    const want = targets[row]!.read();
    if (shown[row * AXES] !== want[0] || shown[row * AXES + 1] !== want[1]) {
      throw new Error(`${label}: row ${row} shows ${shown[row * AXES]}, ${shown[row * AXES + 1]}; read() answers ${want.join(', ')}`);
    }
  }
};

const time = (label: string, fn: () => void): void => {
  check(label, fn);
  const passes = Math.max(20, Math.round(2e7 / N));
  for (let i = 0; i < Math.min(passes, 300); i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < passes; i++) fn();
  const ms = (performance.now() - t0) / passes;
  process.stdout.write(`${String(N).padStart(7)}  ${label.padEnd(26)} ${ms.toFixed(4).padStart(9)} ms a pass ${((ms * 1e6) / N).toFixed(1).padStart(7)} ns a row\n`);
};

time('readInto per target', perTarget);
time('table, through each state', viaState);
time('table, flat', flat);
