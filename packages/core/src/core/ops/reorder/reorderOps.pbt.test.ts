/**
 * Second-pass property tests for the z-order ops: long runs of reorders, moves to an index (any index, finite or
 * not), and whole child-order writes over several parents, through the op history with undo, redo, and a reload
 * from serialized history at any point, against a model of every state an entry left. Every op is a permutation
 * of each parent's children, and an undo or redo lands on exactly the state the model holds. Also the laws a
 * single step obeys: one id brought forward and sent back returns the list, and a moveToIndex at an index outside
 * the integers lands where the integer it truncates to does.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { History } from '@weasel-js/history';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { createHistory } from '../createHistory';
import { bringForward, canBringForward, canSendBackward, moveToIndex, sendBackward } from './algorithms';
import { createMoveToIndexOp, createReorderOp, createSetChildOrderOp, type ReorderDirection } from './index';

const N = 150;
const T = timeoutFor(N, 30);
const t = tally();

/** Parents (root is `null`) and their children; ids named like `Object.prototype` members on purpose. */
const PARENTS = [null, 'g1', '__proto__'] as const;
const KIDS: Record<string, string[]> = {
  root: ['a', 'toString', 'g1', '__proto__', 'b'],
  g1: ['constructor', 'c', 'd', 'hasOwnProperty'],
  ['__proto__']: ['e', 'valueOf', 'f'],
};
type Tree = Record<string, string[]>;
const keyOf = (p: string | null) => p ?? 'root';

function makeAdapter() {
  const tree: Tree = Object.create(null);
  for (const [k, v] of Object.entries(KIDS)) tree[k] = v.slice();
  const parentOf = (id: string): string | null => {
    for (const p of PARENTS) if (tree[keyOf(p)]!.includes(id)) return p;
    return null;
  };
  return {
    tree,
    self: {
      getParent: parentOf,
      getChildren: (p: string | null) => tree[keyOf(p)]!.slice(),
      setChildOrder: (p: string | null, ids: string[]) => {
        const was = tree[keyOf(p)]!;
        expect([...ids].sort(), `a write to ${keyOf(p)} is a permutation`).toEqual([...was].sort());
        tree[keyOf(p)] = ids.slice();
      },
    },
  };
}
type Adapter = ReturnType<typeof makeAdapter>;
interface Real { a: Adapter; h: History }
interface Model { states: Tree[] }

const copy = (tree: Tree): Tree => JSON.parse(JSON.stringify({ ...tree }));
const ALL = Object.values(KIDS).flat();

function settle(m: Model, r: Real, before: number, what: string): void {
  const depth = r.h.undoDepth();
  const now = copy(r.a.tree);
  if (depth === before + 1) {
    // A new entry drops the redo branch: the model keeps only what undo can reach.
    m.states.length = before + 1;
    m.states.push(now);
    t.count(what);
  } else {
    expect(depth, `${what} records one entry or none`).toBe(before);
    expect(now, `${what} that recorded nothing changed nothing`).toEqual(m.states[before]);
    t.count(`noop:${what}`);
  }
}

abstract class Edit implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const before = r.h.undoDepth();
    r.h.applyOps([this.op()], this.toString());
    settle(m, r, before, this.constructor.name);
  }
  abstract op(): ReturnType<typeof createReorderOp>;
  abstract toString(): string;
}

class Reorder extends Edit {
  constructor(readonly direction: ReorderDirection, readonly ids: string[]) { super(); }
  op() { return createReorderOp({ ids: this.ids, direction: this.direction }); }
  toString(): string { return `Reorder(${this.direction}, ${this.ids.join(',')})`; }
}

class MoveTo extends Edit {
  constructor(readonly parent: string | null, readonly ids: string[], readonly index: number) { super(); }
  op() { return createMoveToIndexOp({ ids: this.ids, parentId: this.parent, index: this.index }); }
  toString(): string { return `MoveTo(${this.parent}, ${this.ids.join(',')}, @${this.index})`; }
}

class SetOrder extends Edit {
  constructor(readonly parent: string | null, readonly seed: number) { super(); }
  op() {
    const kids = KIDS[keyOf(this.parent)]!;
    const ids = [...kids].sort((x, y) => ((x.length * 7 + x.charCodeAt(0) * this.seed) % 11) - ((y.length * 7 + y.charCodeAt(0) * this.seed) % 11));
    return createSetChildOrderOp({ orders: [{ parentId: this.parent, ids }] });
  }
  toString(): string { return `SetOrder(${this.parent}, ${this.seed})`; }
}

class Undo implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const depth = r.h.undoDepth();
    r.h.undo();
    if (depth === 0) return;
    expect(copy(r.a.tree)).toEqual(m.states[depth - 1]);
    t.count('Undo');
  }
  toString(): string { return 'Undo'; }
}

class Redo implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    if (!r.h.canRedo()) return;
    const depth = r.h.undoDepth();
    r.h.redo();
    expect(r.h.undoDepth()).toBe(depth + 1);
    expect(copy(r.a.tree)).toEqual(m.states[depth + 1]);
    t.count('Redo');
  }
  toString(): string { return 'Redo'; }
}

/** A new session: the same tree, the history read back from its JSON text. */
class Reload implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(_m: Model, r: Real): void {
    const snap = JSON.parse(JSON.stringify(r.h.serialize()));
    const depth = r.h.undoDepth();
    const redo = r.h.redoDepth();
    r.h = createHistory(r.a.self);
    r.h.restore(snap);
    expect(r.h.undoDepth()).toBe(depth);
    expect(r.h.redoDepth()).toBe(redo);
    t.count('Reload');
  }
  toString(): string { return 'Reload'; }
}

const someIds = fc.array(fc.constantFrom(...ALL, 'stray'), { minLength: 1, maxLength: 4 });
const index = fc.oneof(fc.integer({ min: -2, max: 7 }), fc.constantFrom(NaN, Infinity, -Infinity, 1.5, -0, 2.999));
const commands = fc.commands([
  fc.tuple(fc.constantFrom<ReorderDirection>('forward', 'backward', 'front', 'back'), someIds).map(([d, ids]) => new Reorder(d, ids)),
  fc.tuple(fc.constantFrom(...PARENTS), someIds, index).map(([p, ids, i]) => new MoveTo(p, ids, i)),
  fc.tuple(fc.constantFrom(...PARENTS), fc.integer({ min: 1, max: 9 })).map(([p, s]) => new SetOrder(p, s)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
  fc.constant(new Reload()),
], { maxCommands: 80, size: 'large' });

describe('z-order ops through history', () => {
  it('every undo, redo, and reload lands on the state the model holds', () => {
    fc.assert(fc.property(commands, (cmds) => {
      const a = makeAdapter();
      fc.modelRun(() => ({ model: { states: [copy(a.tree)] }, real: { a, h: createHistory(a.self) } }), cmds);
    }), runs(N));
    for (const k of ['Reorder', 'MoveTo', 'SetOrder', 'Undo', 'Redo', 'Reload']) t.atLeast(k, N / 2);
    t.atLeast('noop:Reorder', 10);
  }, T);
});

describe('z-order laws', () => {
  const list = fc.integer({ min: 1, max: 10 }).chain((n) => fc.shuffledSubarray(Array.from({ length: n }, (_, i) => `n${i}`), { minLength: n, maxLength: n }));

  it('one id brought forward and sent back returns the list, and the other way round', () => {
    fc.assert(fc.property(list, fc.nat(), (l, k) => {
      const id = l[k % l.length]!;
      if (canBringForward(l, [id])) expect(sendBackward(bringForward(l, [id]), [id])).toEqual(l);
      if (canSendBackward(l, [id])) expect(bringForward(sendBackward(l, [id]), [id])).toEqual(l);
      expect(bringForward(l, l)).toEqual(l);
      expect(sendBackward(l, [])).toEqual(l);
    }), runs(N * 2));
  });

  it('moveToIndex at an index that is not an integer, or not finite, lands where its truncated integer does', () => {
    fc.assert(fc.property(list, fc.array(fc.nat({ max: 9 }), { maxLength: 4 }), fc.constantFrom(NaN, Infinity, -Infinity, 0.5, 1.5, 2.999, -0.5, -0), (l, ks, i) => {
      const ids = ks.map((k) => l[k % l.length]!);
      const at = Number.isNaN(i) ? 0 : i === Infinity ? l.length : i === -Infinity ? 0 : Math.trunc(i);
      expect(moveToIndex(l, ids, i)).toEqual(moveToIndex(l, ids, at));
    }), runs(N * 2));
  });
});
