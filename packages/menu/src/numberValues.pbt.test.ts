/**
 * Stateful property test of the rows a menu holds values for: random number writes (finite, infinite, NaN), spin
 * keys, text and color writes, and closing, on rows with and without bounds, steps, endless ends, `set`, or
 * `disabled`, against a model. Every step checks what each row holds, that a write lands only when it changes
 * something on a live, enabled, writable row, and that each landed write reaches the row's `set` and `changed`
 * once. A number row never holds NaN, nor a value outside its bounds that it did not open with.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clampToBounds, spinKey, type Endless } from '@weasel-js/quantity';
import type { MenuColorEntry, MenuNumberEntry, MenuTextEntry } from './entries';
import { createHeldValues } from './heldValues';
import { createNumberValues, menuNumberCanStep } from './numberValues';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

interface Rows { nums: MenuNumberEntry[]; texts: MenuTextEntry[]; colors: MenuColorEntry[] }
interface Model { nums: (number | undefined)[]; texts: (string | undefined)[]; colors: (string | undefined)[]; closed: boolean; changes: number }
interface Real {
  rows: Rows;
  sets: string[];
  changes: number;
  closed: { now: boolean };
  num: ReturnType<typeof createNumberValues>;
  held: ReturnType<typeof createHeldValues>;
}

const t = tally();

function check(m: Model, r: Real): void {
  r.rows.nums.forEach((e, i) => {
    const v = r.num.numberValue(e);
    expect(v).toBe(m.nums[i]);
    if (v !== undefined) {
      expect(Number.isNaN(v)).toBe(false);
      if (v !== e.value) expect(clampToBounds(v, { step: 1, min: e.min, max: e.max, endless: e.endless })).toBe(v);
    }
  });
  r.rows.texts.forEach((e, i) => { expect(r.held.textValue(e)).toBe(m.texts[i]); });
  r.rows.colors.forEach((e, i) => { expect(r.held.colorValue(e)).toBe(m.colors[i]); });
  expect(r.changes).toBe(m.changes);
}

/** Write `next` into the model's slot when the row would take it; whether it did. */
function land<T>(m: Model, slot: (T | undefined)[], i: number, row: { disabled?: boolean; set?: unknown }, next: T): boolean {
  if (m.closed || row.disabled || !row.set || next === slot[i]) return false;
  slot[i] = next;
  m.changes++;
  return true;
}

class SetNumber implements fc.Command<Model, Real> {
  constructor(readonly at: number, readonly value: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const i = this.at % r.rows.nums.length;
    const e = r.rows.nums[i]!;
    const next = clampToBounds(this.value, { step: 1, min: e.min, max: e.max, endless: e.endless });
    const landed = !Number.isNaN(next) && land(m, m.nums, i, e, next);
    const before = r.sets.length;
    r.num.setNumber(e, this.value);
    expect(r.sets.slice(before)).toEqual(landed ? [`${e.key}=${next}`] : []);
    t.count(landed ? (next !== this.value ? 'clamped' : 'set') : 'refused');
    check(m, r);
  }
  toString = (): string => `setNumber(#${this.at}, ${this.value})`;
}

class Spin implements fc.Command<Model, Real> {
  constructor(readonly at: number, readonly key: string) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const i = this.at % r.rows.nums.length;
    const e = r.rows.nums[i]!;
    const from = m.nums[i] ?? e.min ?? 0;
    const bounds = { step: e.step ?? 1, min: e.min, max: e.max, endless: e.endless };
    const next = spinKey(this.key, from, bounds);
    if (this.key === 'ArrowUp' || this.key === 'ArrowDown') {
      expect(menuNumberCanStep(e, from, this.key === 'ArrowUp' ? 1 : -1)).toBe(next !== null && next !== from);
    }
    const landed = next !== null && !Number.isNaN(clampToBounds(next, bounds)) && land(m, m.nums, i, e, clampToBounds(next, bounds));
    expect(r.num.spin(e, this.key)).toBe(next !== null);
    if (landed) t.count('spun');
    check(m, r);
  }
  toString = (): string => `spin(#${this.at}, ${this.key})`;
}

class SetText implements fc.Command<Model, Real> {
  constructor(readonly color: boolean, readonly at: number, readonly value: string) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const rows = this.color ? r.rows.colors : r.rows.texts;
    const i = this.at % rows.length;
    const e = rows[i]!;
    const landed = land(m, this.color ? m.colors : m.texts, i, e, this.value);
    const before = r.sets.length;
    if (this.color) r.held.setColor(e as MenuColorEntry, this.value);
    else r.held.setText(e as MenuTextEntry, this.value);
    expect(r.sets.slice(before)).toEqual(landed ? [`${e.key}=${this.value}`] : []);
    t.count(landed ? 'held' : 'kept');
    check(m, r);
  }
  toString = (): string => `${this.color ? 'setColor' : 'setText'}(#${this.at}, ${JSON.stringify(this.value)})`;
}

class Close implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>): boolean => !m.closed;
  run(m: Model, r: Real): void {
    m.closed = true;
    r.closed.now = true;
    check(m, r);
  }
  toString = (): string => 'close';
}

const bound = fc.option(fc.integer({ min: -20, max: 20 }), { nil: undefined, freq: 3 });
const numRow = fc.record({
  value: fc.option(fc.oneof(fc.integer({ min: -30, max: 30 }), fc.constantFrom(Infinity, -Infinity, 0.5)), { nil: undefined }),
  min: bound, max: bound,
  step: fc.option(fc.constantFrom(1, 0.1, 5, 0.25), { nil: undefined }),
  endless: fc.option(fc.constantFrom<Endless>('min', 'max', 'both'), { nil: undefined, freq: 3 }),
  disabled: fc.constantFrom(undefined, undefined, undefined, true as const),
}).map((x) => (x.min !== undefined && x.max !== undefined && x.min > x.max ? { ...x, min: x.max, max: x.min } : x));
const textRow = fc.record({ value: fc.option(fc.constantFrom('', 'a', '#ff0000'), { nil: undefined }), disabled: fc.constantFrom(undefined, undefined, undefined, true as const), settable: fc.boolean() });

function setup(nums: fc.RecordValue<typeof numRow>[], texts: fc.RecordValue<typeof textRow>[], colors: fc.RecordValue<typeof textRow>[]): { model: Model; real: Real } {
  const sets: string[] = [];
  const closed = { now: false };
  const strip = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  const rows: Rows = {
    nums: nums.map((x, i) => ({ kind: 'number', key: `n${i}`, label: `N${i}`, ...strip(x), value: x.value, set: (v: number) => { sets.push(`n${i}=${v}`); } })),
    texts: texts.map((x, i) => ({ kind: 'text', key: `t${i}`, label: `T${i}`, value: x.value, ...(x.disabled ? { disabled: true } : {}), set: (v: string) => { sets.push(`t${i}=${v}`); } })),
    colors: colors.map((x, i) => ({
      kind: 'color', key: `c${i}`, label: `C${i}`, value: x.value, ...(x.disabled ? { disabled: true } : {}),
      ...(x.settable ? { set: (v: string) => { sets.push(`c${i}=${v}`); } } : {}),
    })),
  };
  const real: Real = { rows, sets, changes: 0, closed, num: undefined!, held: undefined! };
  real.num = createNumberValues(() => { real.changes++; }, () => closed.now);
  real.held = createHeldValues(() => { real.changes++; }, () => closed.now);
  const model: Model = { nums: rows.nums.map((e) => e.value), texts: rows.texts.map((e) => e.value), colors: rows.colors.map((e) => e.value), closed: false, changes: 0 };
  return { model, real };
}

const KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'x'];
const typed = fc.oneof(fc.integer({ min: -40, max: 40 }), fc.double({ min: -40, max: 40, noNaN: true }), fc.constantFrom(NaN, Infinity, -Infinity, -0));

describe('menu value rows, against a model', () => {
  it('hold what was written within bounds, write each change once, and nothing once closed', () => {
    fc.assert(fc.property(
      fc.array(numRow, { minLength: 1, maxLength: 3 }), fc.array(textRow, { minLength: 1, maxLength: 2 }), fc.array(textRow, { minLength: 1, maxLength: 2 }),
      fc.commands([
        fc.tuple(fc.nat(), typed).map(([i, v]) => new SetNumber(i, v)),
        fc.tuple(fc.nat(), typed).map(([i, v]) => new SetNumber(i, v)),
        fc.tuple(fc.nat(), typed).map(([i, v]) => new SetNumber(i, v)),
        fc.tuple(fc.nat(), fc.constantFrom(...KEYS)).map(([i, k]) => new Spin(i, k)),
        fc.tuple(fc.nat(), fc.constantFrom(...KEYS)).map(([i, k]) => new Spin(i, k)),
        fc.tuple(fc.boolean(), fc.nat(), fc.constantFrom('', 'a', 'b', '#00ff00')).map(([c, i, v]) => new SetText(c, i, v)),
        fc.tuple(fc.boolean(), fc.nat(), fc.constantFrom('', 'a', 'b', '#00ff00')).map(([c, i, v]) => new SetText(c, i, v)),
        fc.constant(new Close()),
      ], { size: '+1', maxCommands: 40 }),
      (nums, texts, colors, cmds) => { fc.modelRun(() => setup(nums, texts, colors), cmds); },
    ), runs(RUNS));
    for (const what of ['set', 'clamped', 'refused', 'spun', 'held', 'kept']) t.atLeast(what, RUNS / 6);
  }, timeoutFor(RUNS, 5));
});
