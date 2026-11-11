/**
 * Second-pass stateful test of the guide ops through the real history engine: long runs of adds (new, over an id
 * there is, at an index), moves, and removals, of guides there are, guides gone stale, and guides never added, with
 * undos, redos, and jumps between them. Ids include names `Object.prototype` holds; offsets include coincident
 * guides and non-finite ones. After every step the store holds the list a model of snapshots says it should.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act, renderHook } from '@testing-library/react';
import { createHistory, type History } from '@weasel-js/history';
import { eighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { addGuideOp, removeGuideOp, replaceGuideOp } from './ops';
import type { Guide } from './types';
import { useGuides, type UseGuidesReturn } from './useGuides';

const RUNS = runs(60);
const TIMEOUT = timeoutFor(60, 120);

interface Real { hook: { current: UseGuidesReturn }; history: History }
/** Every list the history has stood on, and where it stands now. */
interface Model { lists: Guide[][]; at: number }

const ID = fc.constantFrom('a', 'b', 'c', '__proto__', 'toString', 'constructor', 'hasOwnProperty');
const offset = fc.oneof({ arbitrary: eighth(20), weight: 6 }, fc.constantFrom(0, -0, 1, NaN, Infinity, -Infinity, 1e300, Number.MIN_VALUE));
const guide = fc.record({ id: ID, axis: fc.constantFrom<'x' | 'y'>('x', 'y'), offset }, { requiredKeys: ['id', 'axis', 'offset'] });
const seen = tally();

const now = (m: Model): Guide[] => m.lists[m.at]!;
const list = (r: Real): readonly Guide[] => r.hook.current.getGuides();

/** Commit `op` as an undo step, and take `next` as the list it leaves. */
function commit(m: Model, r: Real, op: ReturnType<typeof addGuideOp>, next: Guide[] | null): void {
  const depth = r.history.undoDepth();
  act(() => { r.history.apply(op); });
  if (next === null) {
    // A no-op pushes no undo step, and leaves what could be redone.
    expect(r.history.undoDepth()).toBe(depth);
  } else {
    m.lists = [...m.lists.slice(0, m.at + 1), next];
    m.at++;
  }
  expect(list(r)).toEqual(now(m));
}

class Add implements fc.Command<Model, Real> {
  constructor(readonly g: Guide, readonly index: number | undefined) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const cur = now(m);
    const i = cur.findIndex((h) => h.id === this.g.id);
    let next: Guide[];
    if (i >= 0) next = cur.map((h, j) => (j === i ? this.g : h));
    else {
      next = cur.slice();
      next.splice(this.index === undefined ? cur.length : Math.max(0, Math.min(this.index, cur.length)), 0, this.g);
    }
    seen.count(i >= 0 ? 'add over' : 'add');
    commit(m, r, addGuideOp(r.hook.current, this.g, this.index), next);
  }
  toString = () => `add(${JSON.stringify(this.g)}, ${this.index})`;
}

/** Move a guide: the one standing (`stale` false), or a copy of it at another offset, as a press read it before. */
class Move implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly to: number, readonly stale: boolean, readonly id: string) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const cur = now(m);
    const g = cur.length > 0 ? cur[this.pick % cur.length]! : { id: this.id, axis: 'x' as const, offset: 0 };
    const from = this.stale || cur.length === 0 ? { ...g, offset: g.offset + 1 } : g;
    const to = { ...g, offset: this.to };
    seen.count(cur.length === 0 ? 'move missing' : this.stale ? 'move stale' : 'move');
    const i = cur.findIndex((h) => h.id === to.id);
    commit(m, r, replaceGuideOp(r.hook.current, from, to), i >= 0 ? cur.map((h, j) => (j === i ? to : h)) : [...cur, to]);
  }
  toString = () => `move(${this.pick}, ${this.to}, ${this.stale ? 'stale' : 'fresh'}, ${this.id})`;
}

/** Remove a guide: the one standing, a stale copy of it, or one with an id the list does not hold. */
class Remove implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly kind: 'fresh' | 'stale' | 'missing', readonly id: string) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const cur = now(m);
    const missing = this.kind === 'missing' || cur.length === 0;
    const g = missing ? { id: `${this.id}!`, axis: 'y' as const, offset: 3 } : cur[this.pick % cur.length]!;
    const handed = this.kind === 'stale' && !missing ? { ...g, offset: g.offset + 1 } : g;
    seen.count(missing ? 'remove missing' : `remove ${this.kind}`);
    commit(m, r, removeGuideOp(r.hook.current, handed), missing ? null : cur.filter((h) => h.id !== g.id));
  }
  toString = () => `remove(${this.pick}, ${this.kind}, ${this.id})`;
}

class Undo implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>) => m.at > 0;
  run(m: Model, r: Real): void {
    act(() => { r.history.undo(); });
    m.at--;
    seen.count('undo');
    expect(list(r)).toEqual(now(m));
  }
  toString = () => 'undo';
}

class Redo implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>) => m.at < m.lists.length - 1;
  run(m: Model, r: Real): void {
    act(() => { r.history.redo(); });
    m.at++;
    seen.count('redo');
    expect(list(r)).toEqual(now(m));
  }
  toString = () => 'redo';
}

class Goto implements fc.Command<Model, Real> {
  constructor(readonly n: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const to = this.n % m.lists.length;
    act(() => { r.history.goto(to); });
    m.at = to;
    seen.count('goto');
    expect(list(r)).toEqual(now(m));
  }
  toString = () => `goto(${this.n})`;
}

function setup(): Real {
  const { result } = renderHook(() => useGuides());
  return { hook: result, history: createHistory(null) };
}

describe('guide ops through a history, stateful', () => {
  it('every undo, redo, and jump returns the list the history stood on, whatever the ops were handed', () => {
    fc.assert(fc.property(fc.commands([
      fc.tuple(guide, fc.option(fc.integer({ min: -2, max: 8 }), { nil: undefined })).map(([g, i]) => new Add(g, i)),
      fc.tuple(guide, fc.option(fc.integer({ min: -2, max: 8 }), { nil: undefined })).map(([g, i]) => new Add(g, i)),
      fc.tuple(fc.nat(), offset, fc.boolean(), ID).map(([p, o, s, id]) => new Move(p, o, s, id)),
      fc.tuple(fc.nat(), fc.constantFrom('fresh' as const, 'stale' as const, 'missing' as const), ID).map(([p, k, id]) => new Remove(p, k, id)),
      fc.constant(new Undo()),
      fc.constant(new Undo()),
      fc.constant(new Redo()),
      fc.nat().map((n) => new Goto(n)),
    ], { maxCommands: 80, size: 'max' }), (cmds) => {
      fc.modelRun(() => ({ model: { lists: [[]], at: 0 }, real: setup() }), cmds);
    }), RUNS);
    for (const what of ['add', 'add over', 'move', 'move stale', 'remove fresh', 'remove stale', 'remove missing', 'undo', 'redo', 'goto']) seen.atLeast(what, 10);
  }, TIMEOUT);
});
