/**
 * Stateful property test of the menu controller on random menus (items enabled, disabled, and kept open, separators,
 * submenus enabled, disabled, and empty, number and text rows, access letters, labels sharing first letters): random
 * keys under either direction, hovers, presses, and clock advances, against a model of the stack of open levels,
 * the typeahead buffer, the pending submenu open, what ran, the edges reported, and closing. Every step checks the
 * stack and that it is well formed (each open level hangs from an enabled submenu, the highlight lands on rows
 * only), whether the key was the menu's, what ran, number rows, and that the menu closes at most once and is inert
 * after.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EMPTY_TYPEAHEAD, TYPEAHEAD_RESET_MS, isOneChar, type TypeaheadBuffer } from '@weasel-js/ui-input';
import { spinKey } from '@weasel-js/quantity';
import { accessLetter } from './access';
import { createMenuController, SUBMENU_OPEN_MS, type MenuController, type MenuScheduler } from './controller';
import { isRow, type MenuEntry, type MenuNumberEntry } from './entries';
import type { MenuDirection } from './placement';
import { typeaheadStep } from './typeahead';
import { entries, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
type Stack = (number | null)[];

interface Model {
  root: readonly MenuEntry[];
  stack: Stack;
  typed: TypeaheadBuffer;
  now: number;
  pending: { level: number; index: number; at: number } | null;
  closed: boolean;
  ran: string[];
  edges: number[];
  numbers: Map<MenuEntry, number>;
}

interface Real {
  c: MenuController;
  ran: string[];
  edges: number[];
  closes: number;
  notified: number;
  advance(ms: number): void;
}

const t = tally();

/** The entries at `level` along `stack`, walked by hand. */
function levelOf(root: readonly MenuEntry[], stack: readonly (number | null)[], level: number): readonly MenuEntry[] {
  let entries = root;
  for (let i = 0; i < level; i++) {
    const e = stack[i] == null ? undefined : entries[stack[i]!];
    if (e?.kind !== 'submenu') return [];
    entries = e.entries;
  }
  return entries;
}

const firstRowOf = (rows: readonly MenuEntry[]) => { const i = rows.findIndex(isRow); return i < 0 ? null : i; };
const enabledSub = (e: MenuEntry | undefined): e is Extract<MenuEntry, { kind: 'submenu' }> => e?.kind === 'submenu' && !e.disabled;
const same = (a: Stack, b: Stack) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The next row from `at` going `dir`, wrapping; from null, the first or last. */
function nextRow(rows: readonly MenuEntry[], at: number | null, dir: 1 | -1): number | null {
  const n = rows.length;
  for (let k = 1; k <= n; k++) {
    const i = at === null ? (dir === 1 ? k - 1 : n - k) : (((at + dir * k) % n) + n) % n;
    if (isRow(rows[i]!)) return i;
  }
  return null;
}

function choose(m: Model, level: number, index: number): void {
  const e = levelOf(m.root, m.stack, level)[index];
  if (e?.kind !== 'item' || e.disabled) return;
  if (e.keepOpen) {
    m.stack = [...m.stack.slice(0, level), index];
    m.ran.push(e.key);
    t.count('kept open');
    return;
  }
  m.closed = true;
  m.ran.push(e.key);
}

function openAt(m: Model, level: number, index: number): void {
  const e = levelOf(m.root, m.stack, level)[index];
  const base = [...m.stack.slice(0, level), index];
  m.stack = enabledSub(e) ? [...base, null] : base;
}

function stepNumber(m: Model, e: MenuNumberEntry, dir: 1 | -1): void {
  const from = m.numbers.get(e) ?? e.value ?? e.min ?? 0;
  const next = spinKey(dir > 0 ? 'ArrowUp' : 'ArrowDown', from, { step: e.step ?? 1, min: e.min, max: e.max });
  if (next !== null && !Number.isNaN(next) && next !== from) m.numbers.set(e, next);
}

/** What `key` does to the model; whether it was the menu's. */
function keyModel(m: Model, key: string, dir: MenuDirection): boolean {
  if (m.closed) return false;
  const level = m.stack.length - 1;
  const rows = levelOf(m.root, m.stack, level);
  const at = m.stack[level] ?? null;
  const e = at === null ? undefined : rows[at];
  const before = m.stack;
  const nav = (next: Stack) => { m.stack = next; if (!same(next, before)) m.typed = EMPTY_TYPEAHEAD; m.pending = null; return true; };
  const inward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const outward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  const top = (i: number | null) => [...m.stack.slice(0, -1), i];
  const search = (): boolean => {
    m.pending = null;
    const step = typeaheadStep(rows, at, m.typed, key, m.now);
    m.typed = step.buffer;
    if (step.hit !== null) {
      expect(isRow(rows[step.hit]!)).toBe(true);
      m.stack = [...m.stack.slice(0, level), step.hit];
      t.count('typeahead hit');
    }
    return true;
  };
  // A space typed while a search is live is part of it.
  if (key === ' ' && m.typed.text !== '' && m.now - m.typed.at < TYPEAHEAD_RESET_MS) {
    t.count('space searched');
    return search();
  }
  switch (key) {
    case 'ArrowDown': return nav(top(nextRow(rows, at, 1)));
    case 'ArrowUp': return nav(top(nextRow(rows, at, -1)));
    case 'Home': return nav(top(nextRow(rows, null, 1)));
    case 'End': return nav(top(nextRow(rows, null, -1)));
    case 'Escape':
      if (level > 0) return nav(m.stack.slice(0, -1));
      nav(m.stack);
      m.closed = true;
      return true;
    case 'Tab':
      nav(m.stack);
      m.closed = true;
      return true;
    case 'Enter':
    case ' ':
      if (enabledSub(e)) return nav([...m.stack, firstRowOf(e.entries)]);
      nav(m.stack);
      if (e?.kind === 'item' && !e.disabled) choose(m, level, at!);
      return true;
  }
  if (key === inward) {
    if (enabledSub(e)) return nav([...m.stack, firstRowOf(e.entries)]);
    nav(m.stack);
    m.edges.push(1);
    return true;
  }
  if (key === outward) {
    if (level > 0) return nav(m.stack.slice(0, -1));
    nav(m.stack);
    m.edges.push(-1);
    return true;
  }
  if ((key === '+' || key === '=' || key === '-') && e?.kind === 'number' && !e.disabled) {
    nav(m.stack);
    stepNumber(m, e, key === '-' ? -1 : 1);
    t.count('stepped');
    return true;
  }
  if (!isOneChar(key) || key === ' ') return false;
  m.pending = null;
  const letter = rows.findIndex((r) => isRow(r) && accessLetter(r.access) === key.toLowerCase());
  if (letter >= 0) {
    const r = rows[letter]!;
    m.typed = EMPTY_TYPEAHEAD;
    t.count('access');
    if (r.kind === 'item') { if (!r.disabled) choose(m, level, letter); return true; }
    if (r.kind === 'separator' || r.disabled) return true;
    m.stack = r.kind === 'submenu' ? [...m.stack.slice(0, level), letter, firstRowOf(r.entries)] : [...m.stack.slice(0, level), letter];
    return true;
  }
  return search();
}

function hoverModel(m: Model, level: number, index: number | null): void {
  if (m.closed || level >= m.stack.length) return;
  const rows = levelOf(m.root, m.stack, level);
  if (index !== null && !(rows[index] !== undefined && isRow(rows[index]!))) return;
  const sameRow = index === m.stack[level];
  if (sameRow && m.stack.length > level + 1) { m.pending = null; return; }
  if (sameRow && m.pending) return;
  m.pending = null;
  if (index === null && m.stack.length !== level + 1) return;
  m.stack = [...m.stack.slice(0, level), index];
  if (index !== null && enabledSub(rows[index])) m.pending = { level, index, at: m.now + SUBMENU_OPEN_MS };
}

function pressModel(m: Model, level: number, index: number): void {
  if (m.closed || level >= m.stack.length) return;
  const rows = levelOf(m.root, m.stack, level);
  if (!(rows[index] !== undefined && isRow(rows[index]!))) return;
  if (m.stack[level] === index && m.stack.length > level + 1) return;
  m.pending = null;
  if (rows[index]!.kind === 'item') choose(m, level, index);
  else openAt(m, level, index);
}

function check(m: Model, r: Real, before: number): void {
  const stack = r.c.stack();
  expect(stack).toEqual(m.stack);
  for (let i = 0; i < stack.length; i++) {
    const rows = levelOf(m.root, stack, i);
    const at = stack[i];
    if (i < stack.length - 1) expect(enabledSub(at == null ? undefined : rows[at])).toBe(true);
    else if (at !== null) expect(isRow(rows[at!]!)).toBe(true);
  }
  expect(r.ran).toEqual(m.ran);
  expect(r.edges).toEqual(m.edges);
  expect(r.closes).toBe(m.closed ? 1 : 0);
  for (const [e, v] of m.numbers) expect(r.c.numberValue(e as MenuNumberEntry)).toBe(v);
  if (r.notified === before && !m.closed) t.count('quiet');
}

class Key implements fc.Command<Model, Real> {
  constructor(readonly key: string, readonly dir: MenuDirection) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const was = [...m.stack];
    const handled = keyModel(m, this.key, this.dir);
    const before = r.notified;
    expect(r.c.key(this.key, this.dir)).toBe(handled);
    if (!same(was, m.stack)) { expect(r.notified).toBeGreaterThan(before); t.count(m.stack.length > was.length ? 'opened' : 'moved'); }
    check(m, r, before);
  }
  toString = (): string => `key(${JSON.stringify(this.key)}${this.dir === 'rtl' ? ', rtl' : ''})`;
}

class Hover implements fc.Command<Model, Real> {
  constructor(readonly level: number, readonly index: number | null) {}
  check = (m: Readonly<Model>): boolean => this.level < m.stack.length + 1;
  run(m: Model, r: Real): void {
    hoverModel(m, this.level, this.index);
    const before = r.notified;
    r.c.hover(this.level, this.index);
    check(m, r, before);
  }
  toString = (): string => `hover(${this.level}, ${this.index})`;
}

class Press implements fc.Command<Model, Real> {
  constructor(readonly level: number, readonly index: number) {}
  check = (m: Readonly<Model>): boolean => this.level < m.stack.length + 1;
  run(m: Model, r: Real): void {
    pressModel(m, this.level, this.index);
    const before = r.notified;
    r.c.press(this.level, this.index);
    check(m, r, before);
  }
  toString = (): string => `press(${this.level}, ${this.index})`;
}

class Advance implements fc.Command<Model, Real> {
  constructor(readonly ms: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    m.now += this.ms;
    if (m.pending && m.pending.at <= m.now && !m.closed) {
      const { level, index } = m.pending;
      m.pending = null;
      openAt(m, level, index);
      t.count('timed open');
    }
    const before = r.notified;
    r.advance(this.ms);
    check(m, r, before);
  }
  toString = (): string => `advance(${this.ms})`;
}

/** A hover that rests long enough for a submenu under it to open. */
class Linger implements fc.Command<Model, Real> {
  constructor(readonly level: number, readonly index: number) {}
  check = (m: Readonly<Model>): boolean => this.level < m.stack.length;
  run(m: Model, r: Real): void {
    new Hover(this.level, this.index).run(m, r);
    new Advance(SUBMENU_OPEN_MS).run(m, r);
  }
  toString = (): string => `linger(${this.level}, ${this.index})`;
}

function fakeScheduler() {
  let now = 0;
  let timers: { at: number; fn: () => void }[] = [];
  const s: MenuScheduler = {
    now: () => now,
    set(fn, ms) {
      const timer = { at: now + ms, fn };
      timers.push(timer);
      return () => { timers = timers.filter((x) => x !== timer); };
    },
  };
  const advance = (ms: number) => {
    now += ms;
    const due = timers.filter((x) => x.at <= now);
    timers = timers.filter((x) => x.at > now);
    for (const x of due) x.fn();
  };
  return { s, advance };
}

function setup(root: readonly MenuEntry[], highlightFirst: boolean): { model: Model; real: Real } {
  const { s, advance } = fakeScheduler();
  const real: Real = { c: undefined!, ran: [], edges: [], closes: 0, notified: 0, advance };
  const bind = (entries: readonly MenuEntry[]): void => {
    for (const e of entries) {
      if (e.kind === 'item') (e as { run(): void }).run = () => { real.ran.push(e.key); };
      if (e.kind === 'submenu') bind(e.entries);
    }
  };
  bind(root);
  real.c = createMenuController({ entries: root, highlightFirst, onClose: () => { real.closes++; }, onEdge: (d) => { real.edges.push(d); }, scheduler: s });
  real.c.subscribe(() => { real.notified++; });
  const model: Model = {
    root, stack: [highlightFirst ? firstRowOf(root) : null], typed: EMPTY_TYPEAHEAD, now: 0, pending: null,
    closed: false, ran: [], edges: [], numbers: new Map(),
  };
  return { model, real };
}

const KEYS = ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'Home', 'End',
  'Enter', ' ', 'Escape', 'Tab', '+', '+', '-', '-', '=', 'a', 'A', 'b', 'c', 'ä', '2', 'x', 'Shift', 'F2', '😀'];


describe('menu controller, against a model', () => {
  it('keys, hovers, presses, and the clock move the stack, run items, and close as the model says', () => {
    fc.assert(fc.property(entries.filter((xs) => xs.length > 0), fc.boolean(), fc.commands([
      fc.tuple(fc.constantFrom(...KEYS), fc.constantFrom<MenuDirection>('ltr', 'ltr', 'rtl')).map(([k, d]) => new Key(k, d)),
      fc.tuple(fc.constantFrom(...KEYS), fc.constantFrom<MenuDirection>('ltr', 'ltr', 'rtl')).map(([k, d]) => new Key(k, d)),
      fc.tuple(fc.constantFrom(...KEYS), fc.constantFrom<MenuDirection>('ltr', 'ltr', 'rtl')).map(([k, d]) => new Key(k, d)),
      fc.tuple(fc.nat(2), fc.option(fc.nat(3), { freq: 6 })).map(([l, i]) => new Hover(l, i)),
      fc.tuple(fc.nat(2), fc.option(fc.nat(3), { freq: 6 })).map(([l, i]) => new Hover(l, i)),
      fc.tuple(fc.nat(2), fc.nat(3)).map(([l, i]) => new Linger(l, i)),
      fc.tuple(fc.nat(2), fc.nat(3)).map(([l, i]) => new Press(l, i)),
      fc.constantFrom(50, 199, 200, 600).map((ms) => new Advance(ms)),
    ], { size: '+1', maxCommands: 40 }), (root, first, cmds) => {
      fc.modelRun(() => setup(root, first), cmds);
    }), runs(RUNS));
        t.atLeast('moved', RUNS / 2);
    for (const what of ['opened', 'access', 'typeahead hit', 'timed open', 'kept open', 'stepped']) t.atLeast(what, RUNS / 25);
  }, timeoutFor(RUNS, 10));
});
