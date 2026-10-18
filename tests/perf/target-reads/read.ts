// Reads N moving `{ x, y }` targets in plain Node. argv[2]: read | readInto | parts, where parts
// times each piece of a read alone. Run through `node tests/perf/target-reads/run.mjs`.
import { createAnimatorCore } from '../../../packages/animator/src/engine/core';
import { createTarget, stateOf } from '../../../packages/animator/src/target';

type Pt = { x: number; y: number };
const N = Number(process.env.N ?? 10000);
const mode = process.argv[2] ?? 'read';

let now = 0;
const core = createAnimatorCore({
  now: () => now,
  requestFrame: () => {},
  cancelFrame: () => {},
  tripwire: () => false,
  colorOverrides: {} as never,
});
const targets = Array.from({ length: N }, () => {
  let committed: Pt = { x: 0, y: 0 };
  return createTarget<Pt>({ get: () => committed, set: (v) => { committed = v; } });
});
for (const target of targets) core.api.tween<Pt>({ target, to: { x: 500, y: 500 }, ms: 1e9 });
for (let f = 0; f < 5; f++) { now += 16; core.tick(now); }

const sink: Pt[] = new Array(N);
const out = new Float64Array(N * 2);
const states = targets.map((t) => stateOf(t));

const passes: Record<string, () => void> = {
  read: () => { for (let i = 0; i < N; i++) sink[i] = targets[i]!.read(); },
  readInto: () => { for (let i = 0; i < N; i++) targets[i]!.readInto(out, i * 2); },
  // The pieces of a read, each alone, to see which one a read cannot do without paying for.
  get: () => { for (let i = 0; i < N; i++) sink[i] = states[i]!.get(); },
  live: () => { let n = 0; for (let i = 0; i < N; i++) n += states[i]!.live; out[0] = n; },
  slot: () => { let n = 0; for (let i = 0; i < N; i++) { const s = states[i]!.behind[0]!.slot!; n += s.cols[s.at]! + s.cols[s.at + 1]!; } out[0] = n; },
  adjust: () => { let n = 0; for (let i = 0; i < N; i++) { const a = states[i]!.adjust; n += a[0]! + a[1]!; } out[0] = n; },
  write: () => { for (let i = 0; i < N; i++) { const s = states[i]!; s.axes.write!(s.get(), out, i * 2); } },
  add: () => { for (let i = 0; i < N; i++) { const s = states[i]!; sink[i] = s.axes.add!(s.get(), out); } },
};

const time = (label: string, fn: () => void, frames: number): void => {
  for (let i = 0; i < Math.min(frames, 200); i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) fn();
  const ms = (performance.now() - t0) / frames;
  process.stdout.write(`${label.padEnd(10)} ${ms.toFixed(4)} ms a pass   ${((ms * 1e6) / N).toFixed(1).padStart(6)} ns each\n`);
};

// About 2e7 reads a timing, whatever N is, so a run stays in seconds.
const frames = Math.max(20, Math.round(2e7 / N));
if (mode === 'parts') for (const [label, fn] of Object.entries(passes)) time(label, fn, frames);
else time(mode, passes[mode]!, frames);
