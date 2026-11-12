/**
 * Stateful model test of selection: presses, sweeps (reached, then kept or reverted), and the keyboard's landing
 * and activation, on a single selection, a multiple one, and items that own their state, re-rendered with the
 * value after every command as a component would be. Each step checks what every item shows against a plain
 * model, and that a change reports exactly once and a no-op reports nothing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import {
  selection, selectionKeys, selectionOfEach, sweepFrom, type SelectState, type SelectionModel,
} from './selection';

const RUNS = 200;
const N = 6;
const VALUES = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
type V = (typeof VALUES)[number];

interface Config { mode: 'single' | 'multiple' | 'each'; allowDeselect: boolean; followsFocus: boolean; mixed: V[]; disabled: number[] }

/** What the model holds: the value as the component last rendered it, and how many changes were reported. */
interface Model { single: V | null; multiple: V[]; each: boolean[]; reports: number }

interface Real {
  cfg: Config;
  single: V | null;
  multiple: V[];
  each: boolean[];
  reports: number;
  /** A fresh model over the value as last reported: a re-render. */
  model(): SelectionModel;
}

const t = tally();

function makeReal(cfg: Config, init: Model): Real {
  const r: Real = {
    cfg, single: init.single, multiple: [...init.multiple], each: [...init.each], reports: 0,
    model() {
      if (cfg.mode === 'single') {
        return selection({ value: r.single, onChange: (v) => { r.single = v; r.reports++; }, allowDeselect: cfg.allowDeselect, followsFocus: cfg.followsFocus, mixedValues: cfg.mixed }, VALUES);
      }
      if (cfg.mode === 'multiple') {
        return selection({ mode: 'multiple', value: r.multiple, onChange: (v) => { r.multiple = v; r.reports++; }, mixedValues: cfg.mixed }, VALUES);
      }
      return selectionOfEach(r.each.map((selected, i) => ({ selected, onChange: (v: boolean) => { r.each[i] = v; r.reports++; } })));
    },
  };
  return r;
}

const isOn = (m: Model, cfg: Config, i: number): boolean =>
  cfg.mode === 'single' ? m.single === VALUES[i] : cfg.mode === 'multiple' ? m.multiple.includes(VALUES[i]!) : m.each[i]!;

function stateOf(m: Model, cfg: Config, i: number): SelectState {
  if (isOn(m, cfg, i)) return 'on';
  return cfg.mode !== 'each' && cfg.mixed.includes(VALUES[i]!) ? 'mixed' : 'off';
}

/** Set item `i` on or off in the model, as one edit step does; whether it changed. */
function setIn(m: Model, cfg: Config, i: number, on: boolean): boolean {
  const v = VALUES[i]!;
  if (cfg.mode === 'single') {
    const next = on ? v : m.single === v && cfg.allowDeselect ? null : m.single;
    if (next === m.single) return false;
    m.single = next;
  } else if (cfg.mode === 'multiple') {
    if (m.multiple.includes(v) === on) return false;
    m.multiple = on ? [...m.multiple, v] : m.multiple.filter((w) => w !== v);
  } else {
    if (m.each[i] === on) return false;
    m.each[i] = on;
  }
  m.reports++;
  return true;
}

function check(m: Model, r: Real): void {
  const model = r.model();
  for (let i = 0; i < N; i++) expect(model.stateOf(i)).toBe(stateOf(m, r.cfg, i));
  expect(r.reports).toBe(m.reports);
  expect(r.single).toBe(m.single);
  expect(new Set(r.multiple)).toEqual(new Set(m.multiple));
  expect(r.multiple.length).toBe(m.multiple.length);
  expect(r.each).toEqual(m.each);
}

/** A click on item `i`, in the model: choose it or flip it. */
function pressIn(m: Model, cfg: Config, i: number): void {
  if (cfg.mode !== 'single') setIn(m, cfg, i, !isOn(m, cfg, i));
  else if (m.single !== VALUES[i]) setIn(m, cfg, i, true);
  else if (cfg.allowDeselect) { m.single = null; m.reports++; }
}

class Press implements fc.Command<Model, Real> {
  constructor(readonly i: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const before = m.reports;
    pressIn(m, r.cfg, this.i);
    t.count(m.reports === before ? 'press:noop' : 'press');
    r.model().press(this.i);
    check(m, r);
  }
  toString = () => `press(${this.i})`;
}

class Sweep implements fc.Command<Model, Real> {
  constructor(readonly from: number, readonly reach: number[], readonly revert: boolean) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const to = stateOf(m, r.cfg, this.from) !== 'on';
    const start: Model = { ...m, multiple: [...m.multiple], each: [...m.each] };
    // The sweep holds the model it started on, however the value moves under it.
    const sweep = sweepFrom(r.model(), this.from);
    for (const i of this.reach) {
      setIn(m, r.cfg, i, to);
      sweep.reach(i);
      expect(r.reports).toBe(m.reports);
    }
    if (this.revert) {
      const moved = m.single !== start.single || new Set(m.multiple).size !== new Set(start.multiple).size
        || m.multiple.some((v) => !start.multiple.includes(v)) || m.each.some((b, i) => b !== start.each[i]);
      const changedItems = r.cfg.mode === 'each' ? m.each.filter((b, i) => b !== start.each[i]).length : moved ? 1 : 0;
      sweep.revert();
      m.single = start.single;
      m.multiple = [...start.multiple];
      m.each = [...start.each];
      m.reports += changedItems;
      t.count(moved ? 'revert' : 'revert:noop');
    } else t.count('sweep');
    check(m, r);
  }
  toString = () => `sweep(${this.from}, [${this.reach}], ${this.revert ? 'revert' : 'keep'})`;
}

class Key implements fc.Command<Model, Real> {
  constructor(readonly i: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const enabled = (i: number): boolean => !r.cfg.disabled.includes(i);
    const keys = selectionKeys(r.model(), N, enabled);
    const follows = r.cfg.mode === 'single' && r.cfg.followsFocus;
    if (follows) {
      const chosen = VALUES.findIndex((_, i) => isOn(m, r.cfg, i));
      expect(keys.tabStop).toBe(chosen >= 0 ? chosen : undefined);
      expect(keys.activate).toBeUndefined();
      if (enabled(this.i)) setIn(m, r.cfg, this.i, true);
      keys.landed!(this.i);
      t.count('landed');
    } else {
      expect(keys.landed).toBeUndefined();
      if (enabled(this.i)) pressIn(m, r.cfg, this.i);
      keys.activate!(this.i);
      t.count(enabled(this.i) ? 'activate' : 'activate:disabled');
    }
    check(m, r);
  }
  toString = () => `key(${this.i})`;
}

const index = fc.integer({ min: 0, max: N - 1 });
const commands = fc.commands([
  index.map((i) => new Press(i)),
  fc.tuple(index, fc.array(index, { maxLength: 5 }), fc.boolean(), fc.boolean()).map(([f, rs, rv, self]) => new Sweep(f, self ? [f, ...rs] : rs, rv)),
  index.map((i) => new Key(i)),
], { maxCommands: 25 });

const config: fc.Arbitrary<Config> = fc.record({
  mode: fc.constantFrom('single', 'multiple', 'each' as const),
  allowDeselect: fc.boolean(),
  followsFocus: fc.boolean(),
  mixed: fc.subarray([...VALUES]),
  disabled: fc.subarray([0, 1, 2, 3, 4, 5]),
});

describe('selection — stateful model', () => {
  it('shows, presses, sweeps, reverts, and keys as the model says, reporting each change once', () => {
    fc.assert(fc.property(config, fc.subarray([...VALUES]), commands, (cfg, init, cmds) => {
      const start: Model = {
        single: cfg.mode === 'single' ? (init[0] ?? null) : null,
        multiple: cfg.mode === 'multiple' ? init : [],
        each: VALUES.map((v) => cfg.mode === 'each' && init.includes(v)),
        reports: 0,
      };
      fc.modelRun(() => ({ model: { ...start, multiple: [...start.multiple], each: [...start.each] }, real: makeReal(cfg, start) }), cmds);
    }), runs(RUNS));
    for (const k of ['press', 'sweep', 'revert', 'activate', 'activate:disabled']) t.atLeast(k, 50);
    for (const k of ['press:noop', 'revert:noop', 'landed']) t.atLeast(k, 3);
  }, timeoutFor(RUNS, 10));
});
