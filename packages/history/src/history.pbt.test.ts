/**
 * Stateful property test of the history engine: random pushes, coalescing pushes, undo, redo, goto, clear,
 * dropRedo, seal, a serialize-and-restore, and journals, against a model that keeps the store's state after
 * every entry. Each step checks the store against the model, and each push checks that it coalesced exactly
 * when the coalescing rules say it should.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createHistory } from './history';
import type { History } from './historyTypes';
import type { Journal } from './journal';
import type { Op } from './op';

type Store = Map<string, number>;
type State = Record<string, number>;

const KEYS = ['a', 'b', 'c'];
const RUNS = { numRuns: Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 150 };

/** Set `key` to `to`, inverting to `from`. Reports a no-op when the store already holds `to`. */
function setOp(key: string, from: number, to: number, keyed: boolean): Op {
  return {
    name: 'set',
    args: { key, from, to, keyed },
    ...(keyed ? { coalesceKey: `set:${key}` } : {}),
    apply(adapter) {
      const store = adapter as Store;
      const held = (store.get(key) ?? 0) === to;
      store.set(key, to);
      return held ? 'noop' : undefined;
    },
    invert: () => setOp(key, to, from, keyed),
  };
}

const rebuildOp = (name: string, args: unknown): Op | null => {
  if (name !== 'set') return null;
  const { key, from, to, keyed } = args as { key: string; from: number; to: number; keyed: boolean };
  return setOp(key, from, to, keyed);
};

const stateOf = (store: Store): State => Object.fromEntries(KEYS.map((k) => [k, store.get(k) ?? 0]));

/** A line of states: `line[0]` is the floor nothing undoes past, `line[cursor]` is now. */
interface Line {
  line: State[];
  cursor: number;
  /** Whether the next push may merge into the top entry, and the keys and time it would merge on. */
  mergeable: boolean;
  keys: string[];
  at: number;
}

interface Model {
  parent: Line;
  journal: Line | null;
  limit: number;
  windowMs: number;
}

interface Real {
  store: Store;
  history: History;
  journal: Journal | null;
  clock: { t: number };
  options: { limit: number; windowMs: number };
}

function makeHistory(store: Store, clock: { t: number }, limit: number, windowMs: number): History {
  return createHistory(store, {
    coalesceWindowMs: windowMs, now: () => clock.t, rebuildOp,
    ...(Number.isFinite(limit) ? { historyLimit: limit } : {}),
  });
}

const freshLine = (s: State): Line => ({ line: [s], cursor: 0, mergeable: false, keys: [], at: 0 });
const sameKeys = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Advance `l` by a push that left `s`, merging when the rules allow it. */
function push(l: Line, s: State, keys: (string | undefined)[], t: number, windowMs: number, limit: number): 'push' | 'coalesce' {
  const all = keys.every((k): k is string => k !== undefined);
  if (l.mergeable && windowMs > 0 && all && sameKeys(l.keys, keys as string[]) && t - l.at <= windowMs && l.cursor > 0) {
    l.line[l.cursor] = s;
    l.at = t;
    return 'coalesce';
  }
  l.line = [...l.line.slice(0, l.cursor + 1), s];
  l.cursor++;
  while (l.cursor > limit) { l.line.shift(); l.cursor--; }
  l.mergeable = true;
  l.keys = all ? (keys as string[]) : [];
  l.at = t;
  return 'push';
}

const active = (m: Model): Line => m.journal ?? m.parent;

function checkStore(m: Model, r: Real): void {
  const l = active(m);
  expect(stateOf(r.store)).toEqual(l.line[l.cursor]);
  expect(r.history.undoDepth()).toBe(m.parent.cursor);
  expect(r.history.redoDepth()).toBe(m.parent.line.length - 1 - m.parent.cursor);
  if (m.journal && r.journal) {
    expect(r.journal.entries().undo.length).toBe(m.journal.cursor);
    expect(r.journal.entries().redo.length).toBe(m.journal.line.length - 1 - m.journal.cursor);
  }
}

type Cmd = fc.Command<Model, Real>;

/** How often each path ran, so a run that exercised nothing fails rather than passes. */
const tally = new Map<string, number>();
const count = (what: string): void => { tally.set(what, (tally.get(what) ?? 0) + 1); };

class Apply implements Cmd {
  constructor(readonly sets: { key: string; to: number; keyed: boolean }[], readonly wait: number) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    r.clock.t += this.wait;
    const before = stateOf(r.store);
    // Each key once: two writes to one key in a batch would make "from" ambiguous.
    const sets = this.sets.filter((s, i) => this.sets.findIndex((o) => o.key === s.key) === i);
    const ops = sets.map((s) => setOp(s.key, before[s.key]!, s.to, s.keyed));
    if (r.journal) r.journal.applyBatch(ops, 'set'); else r.history.applyOps(ops, 'set');
    const after = stateOf(r.store);
    const changed = sets.some((s) => before[s.key] !== s.to);
    const l = active(m);
    if (!changed) {
      expect(after).toEqual(before);
    } else {
      const depth = r.journal ? r.journal.entries().undo.length : r.history.undoDepth();
      const was = l.cursor;
      const how = push(l, after, ops.map((o) => o.coalesceKey), r.clock.t, m.windowMs, m.journal ? Infinity : m.limit);
      if (how === 'coalesce') expect(depth, 'coalesced into the top entry').toBe(was);
      count(`${how}${m.journal ? ' in journal' : ''}`);
    }
    checkStore(m, r);
  }
  toString(): string { return `Apply(${this.sets.map((s) => `${s.key}=${s.to}${s.keyed ? '*' : ''}`).join(',')} +${this.wait}ms)`; }
}

class Undo implements Cmd {
  check(m: Readonly<Model>): boolean { return active(m as Model).cursor > 0; }
  run(m: Model, r: Real): void {
    const l = active(m);
    (r.journal ?? r.history).undo();
    count('undo');
    l.cursor--;
    l.mergeable = false;
    checkStore(m, r);
  }
  toString(): string { return 'Undo'; }
}

class Redo implements Cmd {
  check(m: Readonly<Model>): boolean { const l = active(m as Model); return l.cursor < l.line.length - 1; }
  run(m: Model, r: Real): void {
    const l = active(m);
    (r.journal ?? r.history).redo();
    l.cursor++;
    l.mergeable = false;
    checkStore(m, r);
  }
  toString(): string { return 'Redo'; }
}

class Goto implements Cmd {
  constructor(readonly to: number) {}
  check(m: Readonly<Model>): boolean { return m.journal === null; }
  run(m: Model, r: Real): void {
    const n = this.to % m.parent.line.length;
    r.history.goto(n);
    if (n !== m.parent.cursor) m.parent.mergeable = false;
    m.parent.cursor = n;
    checkStore(m, r);
  }
  toString(): string { return `Goto(${this.to})`; }
}

/** Stack operations that change no state: clear, dropRedo, seal. */
class Trim implements Cmd {
  constructor(readonly which: 'clear' | 'dropRedo' | 'seal') {}
  check(m: Readonly<Model>): boolean { return m.journal === null; }
  run(m: Model, r: Real): void {
    const l = m.parent;
    count(this.which);
    if (this.which === 'clear') { r.history.clear(); l.line = [l.line[l.cursor]!]; l.cursor = 0; l.mergeable = false; }
    if (this.which === 'dropRedo') {
      const had = l.cursor < l.line.length - 1;
      r.history.dropRedo();
      l.line = l.line.slice(0, l.cursor + 1);
      if (had) l.mergeable = false;
    }
    if (this.which === 'seal') { r.history.seal(); l.mergeable = false; }
    checkStore(m, r);
  }
  toString(): string { return this.which; }
}

/** Persist the stacks through JSON and restore them into a new history over the same store. */
class Restore implements Cmd {
  check(m: Readonly<Model>): boolean { return m.journal === null; }
  run(m: Model, r: Real): void {
    const snapshot = JSON.parse(JSON.stringify(r.history.serialize()));
    r.history = makeHistory(r.store, r.clock, r.options.limit, r.options.windowMs);
    r.history.restore(snapshot);
    m.parent.mergeable = false;
    count('restore');
    checkStore(m, r);
  }
  toString(): string { return 'Restore'; }
}

class Begin implements Cmd {
  check(m: Readonly<Model>): boolean { return m.journal === null; }
  run(m: Model, r: Real): void {
    r.journal = r.history.beginJournal({ label: 'session' });
    m.journal = freshLine(stateOf(r.store));
    checkStore(m, r);
  }
  toString(): string { return 'BeginJournal'; }
}

class End implements Cmd {
  constructor(readonly commit: boolean) {}
  check(m: Readonly<Model>): boolean { return m.journal !== null; }
  run(m: Model, r: Real): void {
    const j = m.journal!;
    if (this.commit) {
      r.journal!.commit('session');
      count('commit');
      // A journal records its applied entries as one parent entry, which nothing merges into; with none applied
      // it leaves the parent as it was, merge window included.
      if (j.cursor > 0) {
        push(m.parent, j.line[j.cursor]!, [undefined], r.clock.t, m.windowMs, m.limit);
        m.parent.mergeable = false;
      }
    } else {
      r.journal!.cancel();
    }
    r.journal = null;
    m.journal = null;
    checkStore(m, r);
  }
  toString(): string { return this.commit ? 'Commit' : 'Cancel'; }
}

const sets = fc.array(fc.record({ key: fc.constantFrom(...KEYS), to: fc.integer({ min: 0, max: 3 }), keyed: fc.boolean() }), { minLength: 1, maxLength: 2 });
const commands = fc.commands([
  fc.tuple(sets, fc.constantFrom(0, 10, 50, 200)).map(([s, w]) => new Apply(s, w)),
  fc.tuple(sets, fc.constantFrom(0, 10)).map(([s, w]) => new Apply(s, w)),
  // A burst of keyed writes to one key: what coalescing exists for.
  fc.tuple(fc.constantFrom(...KEYS), fc.integer({ min: 0, max: 3 })).map(([key, to]) => new Apply([{ key, to, keyed: true }], 10)),
  fc.tuple(fc.constantFrom(...KEYS), fc.integer({ min: 0, max: 3 })).map(([key, to]) => new Apply([{ key, to, keyed: true }], 10)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
  fc.nat({ max: 20 }).map((n) => new Goto(n)),
  fc.constantFrom('clear', 'dropRedo', 'seal').map((w) => new Trim(w as 'clear' | 'dropRedo' | 'seal')),
  fc.constant(new Restore()),
  fc.constant(new Begin()),
  fc.boolean().map((c) => new End(c)),
], { maxCommands: 40, size: 'large' });

describe('history engine, stateful property', () => {
  it('undo, redo, goto, coalescing, eviction, restore, and journals all land on the states the model holds', () => {
    const setup = fc.record({ limit: fc.constantFrom(Infinity, 1, 2, 4), windowMs: fc.constantFrom(0, 100) });
    fc.assert(fc.property(setup, commands, ({ limit, windowMs }, cmds) => {
      const store: Store = new Map();
      const clock = { t: 1000 };
      const real: Real = { store, history: makeHistory(store, clock, limit, windowMs), journal: null, clock, options: { limit, windowMs } };
      const model: Model = { parent: freshLine(stateOf(store)), journal: null, limit, windowMs };
      fc.modelRun(() => ({ model, real }), cmds);
      if (real.journal) { real.journal.cancel(); model.journal = null; }
      // Undoing everything reaches the floor, and redoing everything the newest state.
      real.history.goto(0);
      expect(stateOf(store)).toEqual(model.parent.line[0]);
      real.history.goto(model.parent.line.length - 1);
      expect(stateOf(store)).toEqual(model.parent.line.at(-1));
    }), RUNS);
    for (const what of ['push', 'coalesce', 'push in journal', 'coalesce in journal', 'undo', 'commit', 'restore', 'clear', 'dropRedo', 'seal']) {
      expect(tally.get(what) ?? 0, `${what} ran ${JSON.stringify([...tally])}`).toBeGreaterThan(RUNS.numRuns / 50);
    }
  });
});
