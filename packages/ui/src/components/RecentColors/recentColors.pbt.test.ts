/**
 * Stateful property test of the recent-colors store: records of single colors and gradients' runs in every
 * spelling, clears, storage that refuses writes on command, and stores reopened over the same storage at another
 * limit, against a model of the list and what storage holds. Every step checks the list, that an unchanged list
 * is the same array and emits nothing, and what storage holds.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { createRecentColorsStore, normalizeRecentColor, type RecentColorsStore } from './recentColors';

const RUNS = 150;
const KEY = 'recent';

/** One spelling of the model's: hex of any length to lowercase `#rrggbbaa`, anything else trimmed. */
function spelling(raw: string): string | null {
  const s = raw.trim();
  if (s === '') return null;
  if (!s.startsWith('#')) return s;
  const h = s.slice(1);
  if (!/^[0-9a-f]+$/i.test(h) || ![3, 4, 6, 8].includes(h.length)) return s.toLowerCase();
  const full = h.length <= 4 ? [...h].map((c) => c + c).join('') : h;
  return `#${full.length === 6 ? `${full}ff` : full}`.toLowerCase();
}

const hexDigit = fc.constantFrom(...'0123456789abcdefABCDEF');
const color = fc.oneof(
  fc.constantFrom(3, 4, 6, 8).chain((n) => fc.array(hexDigit, { minLength: n, maxLength: n })).map((d) => `#${d.join('')}`),
  fc.constantFrom('#fff', '#FFFFFF', '#ffffffff', '#f00', '#ff0000', ' #f00 ', '#F00F'),
  fc.constantFrom('red', 'Red', ' red', 'rgb(0 0 0)', '', '   ', '#zz', '#12345', 'transparent', '__proto__'),
);

interface Model { list: string[]; stored: string | null; limit: number; refuse: boolean }
interface Real { store: RecentColorsStore; storage: Fake; emits: number; off: () => void }
interface Fake { text: string | null; refuse: boolean; getItem(k: string): string | null; setItem(k: string, v: string): void }

const tl = tally();

function fake(): Fake {
  return {
    text: null,
    refuse: false,
    getItem(k) { return k === KEY ? this.text : null; },
    setItem(k, v) { if (this.refuse) throw new Error('quota'); if (k === KEY) this.text = v; },
  };
}

function open(storage: Fake, limit: number): Real {
  const store = createRecentColorsStore({ storage, key: KEY, limit });
  const real: Real = { store, storage, emits: 0, off: () => {} };
  real.off = store.subscribe(() => { real.emits++; });
  return real;
}

function headOf(colors: readonly string[], rest: readonly string[], limit: number): string[] {
  const out: string[] = [];
  for (const c of [...colors, ...rest]) {
    const s = spelling(c);
    if (s !== null && !out.includes(s)) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Apply `next` to the model and the store's own change, then check every shared fact. */
function settle(m: Model, r: Real, next: string[], act: () => void): void {
  const was = r.store.get();
  const emits = r.emits;
  act();
  const changed = JSON.stringify(next) !== JSON.stringify(m.list);
  if (changed) {
    m.list = next;
    if (!m.refuse) m.stored = JSON.stringify(next);
    tl.count(m.refuse ? 'refused write' : 'write');
  } else tl.count('unchanged');
  expect(r.store.get()).toEqual(m.list);
  expect(r.emits - emits).toBe(changed ? 1 : 0);
  if (!changed) expect(r.store.get()).toBe(was);
  expect(r.storage.text).toBe(m.stored);
}

class Record implements fc.Command<Model, Real> {
  constructor(readonly colors: string | string[]) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const list = typeof this.colors === 'string' ? [this.colors] : this.colors;
    if (list.length > 1) tl.count('run');
    settle(m, r, headOf(list, m.list, m.limit), () => r.store.record(this.colors));
    expect(m.list.length).toBeLessThanOrEqual(m.limit);
    if (m.list.length === m.limit) tl.count('full');
  }
  toString = () => `record(${JSON.stringify(this.colors)})`;
}

class Clear implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void { settle(m, r, [], () => r.store.clear()); }
  toString = () => 'clear';
}

class Refuse implements fc.Command<Model, Real> {
  constructor(readonly on: boolean) {}
  check = () => true;
  run(m: Model, r: Real): void { m.refuse = this.on; r.storage.refuse = this.on; }
  toString = () => `refuse(${this.on})`;
}

class Reopen implements fc.Command<Model, Real> {
  constructor(readonly limit: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    r.off();
    r.store = createRecentColorsStore({ storage: r.storage, key: KEY, limit: this.limit });
    r.off = r.store.subscribe(() => { r.emits++; });
    m.limit = this.limit;
    let held: unknown[] = [];
    try { const p: unknown = m.stored === null ? [] : JSON.parse(m.stored); held = Array.isArray(p) ? p : []; } catch { held = []; }
    m.list = headOf(held.filter((c): c is string => typeof c === 'string'), [], m.limit);
    expect(r.store.get()).toEqual(m.list);
    tl.count('reopen');
  }
  toString = () => `reopen(${this.limit})`;
}

describe('recent colors store', () => {
  it('matches a model of its list and its storage', () => {
    const commands = fc.commands([
      color.map((c) => new Record(c)),
      fc.array(color, { maxLength: 5 }).map((cs) => new Record(cs)),
      fc.constant(new Clear()),
      fc.boolean().map((on) => new Refuse(on)),
      fc.integer({ min: 1, max: 6 }).map((n) => new Reopen(n)),
    ], { maxCommands: 40 });
    fc.assert(fc.property(fc.integer({ min: 1, max: 6 }), commands, (limit, cmds) => {
      const storage = fake();
      const real = open(storage, limit);
      fc.modelRun(() => ({ model: { list: [], stored: null, limit, refuse: false }, real }), cmds);
      real.off();
    }), runs(RUNS));
    for (const k of ['write', 'refused write', 'unchanged', 'reopen', 'full', 'run']) tl.atLeast(k, 30);
  }, timeoutFor(RUNS, 10));

  it('spells a color the way the model does', () => {
    fc.assert(fc.property(color, (c) => { expect(normalizeRecentColor(c)).toBe(spelling(c)); }), runs(300));
  }, timeoutFor(300, 1));
});

describe('recent colors store over foreign storage', () => {
  it('reads whatever storage holds without throwing, keeping its strings', () => {
    const anything = fc.oneof(fc.json(), fc.string(), fc.array(fc.oneof(color, fc.integer(), fc.constant(null))).map((a) => JSON.stringify(a)));
    fc.assert(fc.property(anything, fc.integer({ min: 1, max: 6 }), (text, limit) => {
      const storage = fake();
      storage.text = text;
      const store = createRecentColorsStore({ storage, key: KEY, limit });
      let held: unknown;
      try { held = JSON.parse(text); } catch { held = null; }
      const want = Array.isArray(held) ? headOf(held.filter((c): c is string => typeof c === 'string'), [], limit) : [];
      expect(store.get()).toEqual(want);
    }), runs(300));
  }, timeoutFor(300, 1));
});
