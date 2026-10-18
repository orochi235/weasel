// A frame of N moving [x, y] values, read every frame: as targets read one at a time, and as
// rows of a target table. Steady, then with rows stopping and starting every frame.
// Run through `node tests/perf/target-reads/run.mjs table <N>... <idle | targets | table | held | heldfn | heldrows>`.
// `held` is N table rows with a hold each and no animation; `heldfn` gives each hold its value
// as a function, which is asked every frame; `heldrows` holds them all with `animator.holdRows`,
// whose values are written in place and touched every frame.
// `idle` is the frame with nothing read, to take off the other two.
import { createAnimatorCore } from '../../../packages/animator/src/engine/core';
import { createTarget, stateOf, type Target } from '../../../packages/animator/src/target';
import { createTargetTable } from '../../../packages/animator/src/targetTable';
import type { AnimationHandle } from '../../../packages/animator/src/types';

const N = Number(process.env.N ?? 10000);
const AXES = 2;
/** Rows stopped and started again each frame of a churned pass. */
const CHURN = Math.max(1, Math.round(N / 100));

function mount() {
  let now = 0;
  const core = createAnimatorCore({
    now: () => now,
    requestFrame: () => {},
    cancelFrame: () => {},
    tripwire: () => false,
    colorOverrides: {} as never,
  });
  return { api: core.api, frame: (): void => { now += 16; core.tick(now); } };
}

interface Case {
  /** One frame, then every value read into `out`. */
  frame(): void;
  /** Stops `CHURN` rows' animations and starts new ones on them. */
  churn(): void;
  out(): Float64Array;
  /** What row `row` shows, read the slow way, to check `out` against. */
  read(row: number): number[];
}

function build(targetOf: (row: number) => Target<number[]>, m: ReturnType<typeof mount>, after: () => void, out: () => Float64Array): Case {
  const handles: AnimationHandle[] = [];
  const start = (row: number): void => {
    handles[row] = m.api.tween<number[]>({ target: targetOf(row), to: [500 + row, 100 + row], ms: 1e9 });
  };
  for (let row = 0; row < N; row++) start(row);
  for (let f = 0; f < 5; f++) m.frame();
  let next = 0;
  return {
    frame: () => { m.frame(); after(); },
    churn: () => {
      for (let i = 0; i < CHURN; i++) {
        handles[next]!.cancel();
        start(next);
        next = (next + 1) % N;
      }
    },
    out,
    read: (row) => targetOf(row).read(),
  };
}

function targetsCase(): Case {
  const m = mount();
  const committed = new Float64Array(N * AXES);
  const out = new Float64Array(N * AXES);
  const targets = Array.from({ length: N }, (_, row) => createTarget<number[]>({
    get: () => [committed[row * AXES]!, committed[row * AXES + 1]!],
    set: (v) => { committed[row * AXES] = v[0]!; committed[row * AXES + 1] = v[1]!; },
  }));
  const readAll = (): void => { for (let row = 0; row < N; row++) targets[row]!.readInto(out, row * AXES); };
  return build((row) => targets[row]!, m, readAll, () => out);
}

function tableCase(): Case {
  const m = mount();
  const table = createTargetTable({ axes: AXES });
  for (let row = 0; row < N; row++) table.add([0, 0]);
  // Made ahead of the animations, as the other cases' targets are: made in turn with them, the
  // frame walks memory laid out differently and reads 20 ns a row slower for it.
  for (let row = 0; row < N; row++) table.target(row);
  // Reading `shown` is the whole read: the frame filled it.
  const made = build((row) => table.target(row), m, () => { void table.shown; }, () => table.shown);
  const rows = stateOf(table.target(0)).row!.table;
  const fill = rows.fill.bind(rows);
  passAlone = () => {
    let columns: Parameters<typeof fill>[0] = null;
    rows.fill = (c) => { columns = c; fill(c); };
    made.frame();
    rows.fill = fill;
    time('table, its pass alone', () => fill(columns));
  };
  return made;
}

/** The table's own pass over its columns, apart from the frame around it, which at 100k rows
 *  varies by more than the pass costs. Takes the columns a frame hands it and runs it again. */
let passAlone = (): void => {};

function check(label: string, c: Case): void {
  c.churn();
  c.frame();
  const out = c.out();
  for (const row of [0, 1, N >> 1, N - 1]) {
    const want = c.read(row);
    if (Math.abs(out[row * AXES]! - want[0]!) > 1e-9 || Math.abs(out[row * AXES + 1]! - want[1]!) > 1e-9) {
      throw new Error(`${label}: row ${row} shows ${out[row * AXES]}, ${out[row * AXES + 1]}; read() answers ${want.join(', ')}`);
    }
  }
}

function time(label: string, fn: () => void): void {
  // About 4e6 row-frames a timing, so a run stays in seconds whatever N is.
  const frames = Math.max(10, Math.round(4e6 / N));
  for (let i = 0; i < Math.min(frames, 100); i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) fn();
  const ms = (performance.now() - t0) / frames;
  process.stdout.write(`${String(N).padStart(7)}  ${label.padEnd(34)} ${ms.toFixed(4).padStart(9)} ms a frame ${((ms * 1e6) / N).toFixed(1).padStart(7)} ns a row\n`);
}

const idleCase = (): Case => {
  const committed = new Float64Array(N * AXES);
  const targets = Array.from({ length: N }, (_, row) => createTarget<number[]>({
    get: () => [committed[row * AXES]!, committed[row * AXES + 1]!],
    set: (v) => { committed[row * AXES] = v[0]!; committed[row * AXES + 1] = v[1]!; },
  }));
  return build((row) => targets[row]!, mount(), () => {}, () => new Float64Array(0));
};

/** N rows of a table with a hold on each and nothing else moving them. */
function heldCase(asked: boolean): void {
  const m = mount();
  const table = createTargetTable({ axes: AXES });
  for (let row = 0; row < N; row++) {
    table.add([0, 0]);
    const value = [row, 100];
    m.api.hold({ target: table.target(row), value: asked ? () => value : value, weight: 0.5 });
  }
  for (let f = 0; f < 5; f++) m.frame();
  time(asked ? 'held by a function, steady' : 'held, steady', () => { m.frame(); void table.shown; });
  const row = N >> 1;
  const want = table.target(row).read();
  if (table.shown[row * AXES] !== want[0] || want[0] !== row / 2) throw new Error(`held: row ${row} shows ${table.shown[row * AXES]}`);
}

/** N rows of a table held by one `holdRows`, their values written and touched every frame. */
function heldRowsCase(): void {
  const m = mount();
  const table = createTargetTable({ axes: AXES });
  for (let row = 0; row < N; row++) table.add([0, 0]);
  const h = m.api.holdRows({ table, weight: 0.5 });
  let k = 0;
  const write = (): void => {
    k += 1;
    const v = h.values;
    for (let row = 0; row < N; row++) { v[row * AXES] = row + k; v[row * AXES + 1] = 100; }
    h.touch();
  };
  for (let f = 0; f < 5; f++) { write(); m.frame(); }
  time('held by holdRows, written a frame', () => { write(); m.frame(); void table.shown; });
  const row = N >> 1;
  const want = table.target(row).read();
  if (table.shown[row * AXES] !== want[0] || want[0] !== (row + k) / 2) throw new Error(`heldrows: row ${row} shows ${table.shown[row * AXES]}`);
}

// One case a process (argv[2]: idle | targets | table | held | heldfn | heldrows): three sets of targets alive together
// push each other out of cache, and a frame at 100k rows is bound by memory.
const which = process.argv[2] ?? 'table';
if (which === 'heldrows') {
  heldRowsCase();
  process.exit(0);
}
if (which === 'held' || which === 'heldfn') {
  heldCase(which === 'heldfn');
  process.exit(0);
}
const c = which === 'idle' ? idleCase() : which === 'targets' ? targetsCase() : tableCase();
if (which !== 'idle') check(which, c);
time(`${which}, steady`, c.frame);
if (which === 'table') passAlone();
time(`${which}, ${CHURN} rows restarted a frame`, () => { c.churn(); c.frame(); });
// Whether the frame gets its steady cost back once nothing restarts.
time(`${which}, steady again`, c.frame);
