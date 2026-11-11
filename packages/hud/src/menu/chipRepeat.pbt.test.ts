/**
 * Stateful property test of hold-to-repeat on a HUD menu's number chips: presses, pointer moves and releases on and
 * off the held chip, stops, and timer ticks, against a model of the value each row holds, the chip held, and the one
 * timer pending.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMenuController, type MenuController, type MenuNumberEntry } from '@weasel-js/menu';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createChipHold, type ChipHold, type MenuChip } from './chipRepeat';

const RUNS = 200;
const DELAY = 400, EVERY = 60;

interface Model { values: (number | undefined)[]; held: { row: number; dir: 1 | -1 } | null; wait: number | null }
interface Real {
  c: MenuController; hold: ChipHold; rows: MenuNumberEntry[];
  timers: { fn: () => void; ms: number; live: boolean }[];
}

const hits = tally();

/** Points the fake hit test knows: 0 is off every chip, then each row's minus and plus chips in turn. A disabled
 *  row has none, as `chipUnder` finds. */
const chipAtPoint = (rows: readonly MenuNumberEntry[], p: number): MenuChip | null => {
  if (p === 0 || p > rows.length * 2) return null;
  const entry = rows[(p - 1) >> 1]!;
  return entry.disabled ? null : { entry, dir: (p - 1) % 2 === 0 ? -1 : 1 };
};

const canStep = (e: MenuNumberEntry, v: number, dir: 1 | -1) => (dir > 0 ? e.max === undefined || v < e.max : e.min === undefined || v > e.min);
const from = (m: Model, r: Real, row: number) => m.values[row] ?? r.rows[row]!.min ?? 0;

function step(m: Model, r: Real, row: number, dir: 1 | -1): void {
  const e = r.rows[row]!;
  let v = from(m, r, row) + dir;
  if (e.min !== undefined) v = Math.max(e.min, v);
  if (e.max !== undefined) v = Math.min(e.max, v);
  m.values[row] = v;
}

function check(m: Model, r: Real): void {
  expect(r.rows.map((e) => r.c.numberValue(e))).toEqual(m.values);
  const live = r.timers.filter((t) => t.live);
  expect(live.map((t) => t.ms)).toEqual(m.wait === null ? [] : [m.wait]);
}

type Cmd = fc.Command<Model, Real>;
const cmd = (name: string, run: (m: Model, r: Real) => void): Cmd => ({
  check: () => true, run(m, r) { run(m, r); check(m, r); }, toString: () => name,
});
const point = fc.nat({ max: 6 });

const press = point.map((p) => cmd(`press ${p}`, (m, r) => {
  r.hold.press(p, 0);
  const chip = chipAtPoint(r.rows, p);
  if (!chip) return;
  const row = r.rows.indexOf(chip.entry);
  step(m, r, row, chip.dir);
  m.held = { row, dir: chip.dir };
  m.wait = DELAY;
  hits.hit('press');
}));

const follow = fc.option(point, { nil: null }).map((p) => cmd(`follow ${p}`, (m, r) => {
  r.hold.follow(p === null ? null : { x: p, y: 0 });
  if (!m.held) return;
  const chip = p === null ? null : chipAtPoint(r.rows, p);
  if (chip && r.rows.indexOf(chip.entry) === m.held.row && chip.dir === m.held.dir) { hits.hit('stays'); return; }
  m.held = null;
  m.wait = null;
  hits.hit('slides off');
}));

const followHeld = fc.constant(cmd('follow the held chip', (m, r) => {
  if (!m.held) return;
  r.hold.follow({ x: m.held.row * 2 + (m.held.dir < 0 ? 1 : 2), y: 0 });
  hits.hit('stays');
}));

const stop = fc.constant(cmd('stop', (m, r) => { r.hold.stop(); m.held = null; m.wait = null; }));

const tick = fc.constant(cmd('tick', (m, r) => {
  const t = r.timers.find((x) => x.live);
  if (t) { t.live = false; t.fn(); }
  if (!m.held) return;
  const e = r.rows[m.held.row]!;
  if (e.disabled || !canStep(e, from(m, r, m.held.row), m.held.dir)) {
    m.held = null; m.wait = null; hits.hit('spent');
    return;
  }
  step(m, r, m.held.row, m.held.dir);
  m.wait = EVERY;
  hits.hit('repeat');
}));

const rowArb = fc.record({
  value: fc.option(fc.integer({ min: -5, max: 5 }), { nil: undefined }),
  min: fc.option(fc.integer({ min: -6, max: -5 }), { nil: undefined }),
  max: fc.option(fc.integer({ min: 5, max: 6 }), { nil: undefined }),
  disabled: fc.boolean(),
});

describe('createChipHold (stateful)', () => {
  it('steps once on a press, then once a tick until released, slid off, or spent', () => {
    fc.assert(fc.property(fc.tuple(rowArb, rowArb, rowArb), fc.commands([press, press, follow, followHeld, stop, tick, tick, tick, tick], { maxCommands: 50, size: 'large' }), (specs, cmds) => {
      const rows = specs.map((s, i) => {
        const e: Record<string, unknown> = { kind: 'number', key: `n${i}`, label: `N${i}`, value: s.value, disabled: s.disabled, set: () => {} };
        if (s.min !== undefined) e.min = s.min;
        if (s.max !== undefined) e.max = s.max;
        return e as unknown as MenuNumberEntry;
      });
      const c = createMenuController({ entries: rows, onClose: () => {} });
      const timers: Real['timers'] = [];
      const scheduler = { set: (fn: () => void, ms: number) => { const t = { fn, ms, live: true }; timers.push(t); return () => { t.live = false; }; } };
      const hold = createChipHold(c, (x) => chipAtPoint(rows, x), { delayMs: DELAY, everyMs: EVERY, scheduler });
      const m: Model = { values: rows.map((e) => e.value), held: null, wait: null };
      fc.modelRun(() => ({ model: m, real: { c, hold, rows, timers } }), cmds);
    }), runs(RUNS));
    for (const k of ['press', 'stays', 'slides off', 'spent', 'repeat']) hits.atLeast(k, 20);
  }, timeoutFor(RUNS, 20));
});
