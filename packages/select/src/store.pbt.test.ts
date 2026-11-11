/**
 * Stateful property test of `createSelectionStore`: random sets (with repeats, unchanged, reordered, emptied) and
 * subscribes and unsubscribes against a model. Every step checks the ids, each once at its first place, that a set
 * leaving them as they were notifies no one and keeps the array readers hold, and that a change notifies each
 * listener once.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSelectionStore, type SelectionStore } from './store';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

interface Model { ids: number[]; on: Set<number> }
interface Real { store: SelectionStore<number>; heard: number[]; offs: Map<number, () => void> }

const t = tally();
const firsts = (ids: readonly number[]) => ids.filter((x, i) => ids.indexOf(x) === i);

class SetIds implements fc.Command<Model, Real> {
  constructor(readonly ids: readonly number[], readonly same: boolean) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const next = this.same ? [...m.ids, ...m.ids.slice(0, 1)] : this.ids;
    const before = r.store.getSelection();
    const want = firsts(next);
    const changes = want.length !== m.ids.length || want.some((x, i) => x !== m.ids[i]);
    r.heard.length = 0;
    r.store.setSelection(next);
    expect(r.store.getSelection()).toEqual(want);
    expect([...r.heard].sort()).toEqual(changes ? [...m.on].sort() : []);
    if (!changes) expect(r.store.getSelection()).toBe(before);
    else if (want.length === next.length) expect(r.store.getSelection()).toBe(next);
    t.count(changes ? 'changed' : 'unchanged');
    if (next.length !== want.length) t.count('repeats');
    m.ids = want;
  }
  toString = (): string => (this.same ? 'set(same)' : `set(${JSON.stringify(this.ids)})`);
}

class Subscribe implements fc.Command<Model, Real> {
  constructor(readonly who: number) {}
  check = (m: Readonly<Model>): boolean => !m.on.has(this.who);
  run(m: Model, r: Real): void {
    m.on.add(this.who);
    r.offs.set(this.who, r.store.subscribe(() => { r.heard.push(this.who); }));
  }
  toString = (): string => `subscribe(${this.who})`;
}

class Unsubscribe implements fc.Command<Model, Real> {
  constructor(readonly who: number) {}
  check = (m: Readonly<Model>): boolean => m.on.has(this.who);
  run(m: Model, r: Real): void {
    m.on.delete(this.who);
    r.offs.get(this.who)!();
  }
  toString = (): string => `unsubscribe(${this.who})`;
}

const ids = fc.array(fc.integer({ min: 0, max: 4 }), { maxLength: 6 });
const who = fc.integer({ min: 0, max: 2 });

describe('createSelectionStore, against a model', () => {
  it('holds each id once, and notifies each listener once per change and never otherwise', () => {
    fc.assert(fc.property(ids, fc.commands([
      ids.map((xs) => new SetIds(xs, false)),
      fc.constant(new SetIds([], true)),
      who.map((w) => new Subscribe(w)),
      who.map((w) => new Unsubscribe(w)),
    ], { maxCommands: 25 }), (initial, cmds) => {
      const store = createSelectionStore(initial);
      expect(store.getSelection()).toEqual(firsts(initial));
      fc.modelRun(() => ({ model: { ids: firsts(initial), on: new Set() }, real: { store, heard: [], offs: new Map() } }), cmds);
    }), runs(RUNS));
    t.atLeast('changed', RUNS / 3);
    t.atLeast('unchanged', RUNS / 4);
    t.atLeast('repeats', RUNS / 2);
  }, timeoutFor(RUNS, 3));
});
