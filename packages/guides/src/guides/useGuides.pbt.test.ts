/**
 * Stateful property test of `useGuides` and the guide ops: random adds, removes, and clears straight to
 * the hook, then random ops undone and redone, each against a plain model of the list. Every step checks
 * `guides`, `getGuides`, and that `subscribe` heard a change exactly when the list changed.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act, renderHook } from '@testing-library/react';
import type { Op } from '@weasel-js/core';
import { eighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { addGuideOp, removeGuideOp, replaceGuideOp } from './ops';
import type { Guide } from './types';
import { useGuides, type UseGuidesReturn } from './useGuides';

const RUNS = runs(60);
const TIMEOUT = timeoutFor(60, 60);

interface Real {
  hook: { current: UseGuidesReturn };
  heard: { n: number };
}
type Model = { list: Guide[] };

const ids = fc.constantFrom('a', 'b', 'c', 'd', 'e');
const guide = fc.record({ id: ids, axis: fc.constantFrom<'x' | 'y'>('x', 'y'), offset: eighth(100) });

function check(m: Model, r: Real, changed: boolean, heardBefore: number): void {
  expect(r.hook.current.guides).toEqual(m.list);
  expect(r.hook.current.getGuides()).toEqual(m.list);
  expect(r.heard.n - heardBefore).toBe(changed ? 1 : 0);
}

function step(m: Model, r: Real, next: Guide[], act0: () => void): void {
  const before = r.heard.n;
  const changed = JSON.stringify(next) !== JSON.stringify(m.list);
  act(act0);
  m.list = next;
  check(m, r, changed, before);
}

const seen = tally();

class Add implements fc.Command<Model, Real> {
  constructor(readonly g: Guide) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const i = m.list.findIndex((h) => h.id === this.g.id);
    seen.count(i === -1 ? 'add' : 'replace');
    step(m, r, i === -1 ? [...m.list, this.g] : m.list.map((h, j) => (j === i ? this.g : h)), () => r.hook.current.addGuide(this.g));
  }
  toString = () => `add(${JSON.stringify(this.g)})`;
}

class Remove implements fc.Command<Model, Real> {
  constructor(readonly id: string) {}
  check = () => true;
  run(m: Model, r: Real): void {
    seen.count(m.list.some((g) => g.id === this.id) ? 'remove' : 'remove missing');
    step(m, r, m.list.filter((g) => g.id !== this.id), () => r.hook.current.removeGuide(this.id));
  }
  toString = () => `remove(${this.id})`;
}

class Clear implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    seen.count('clear');
    step(m, r, [], () => r.hook.current.clearGuides());
  }
  toString = () => 'clear';
}

function setup(): Real {
  const heard = { n: 0 };
  const { result } = renderHook(() => useGuides());
  act(() => { result.current.subscribe(() => { heard.n++; }); });
  return { hook: result, heard };
}

/** The list as a set of guides by id: an undo restores which guides there are, not where in the list. */
const byId = (list: readonly Guide[]) => [...list].sort((a, b) => (a.id < b.id ? -1 : 1));

describe('useGuides, stateful', () => {
  it('holds the list a plain model holds through any adds, removes, and clears', () => {
    fc.assert(fc.property(fc.commands([
      guide.map((g) => new Add(g)),
      guide.map((g) => new Add(g)),
      guide.map((g) => new Add(g)),
      ids.map((id) => new Remove(id)),
      ids.map((id) => new Remove(id)),
      fc.constant(new Clear()),
    ], { maxCommands: 30, size: 'max' }), (cmds) => {
      fc.modelRun(() => ({ model: { list: [] }, real: setup() }), cmds);
    }), RUNS);
    for (const what of ['add', 'replace', 'remove', 'remove missing', 'clear']) seen.atLeast(what, 15);
  }, TIMEOUT);

  it('undoing guide ops in reverse returns each earlier list, and redoing them returns each later one', () => {
    const t = tally();
    // Each step: add a new guide, move or remove one there is, or undo / redo.
    const action = fc.oneof(
      { arbitrary: fc.record({ kind: fc.constant('add' as const), axis: fc.constantFrom<'x' | 'y'>('x', 'y'), offset: eighth(100) }), weight: 3 },
      { arbitrary: fc.record({ kind: fc.constant('move' as const), pick: fc.nat(), offset: eighth(100) }), weight: 3 },
      { arbitrary: fc.record({ kind: fc.constant('remove' as const), pick: fc.nat() }), weight: 1 },
      { arbitrary: fc.constant({ kind: 'undo' as const }), weight: 2 },
      { arbitrary: fc.constant({ kind: 'redo' as const }), weight: 2 },
    );
    fc.assert(fc.property(fc.array(action, { minLength: 5, maxLength: 30 }), (actions) => {
      const r = setup();
      const store = r.hook.current;
      const done: { op: Op; before: Guide[] }[] = [];
      const undone: { op: Op; after: Guide[] }[] = [];
      let fresh = 0;
      const now = () => r.hook.current.getGuides();
      for (const a of actions) {
        const list = now();
        let op: Op | null = null;
        if (a.kind === 'add') op = addGuideOp(store, { id: `n${fresh++}`, axis: a.axis, offset: a.offset });
        else if ((a.kind === 'move' || a.kind === 'remove') && list.length > 0) {
          const g = list[a.pick % list.length]!;
          op = a.kind === 'move' ? replaceGuideOp(store, g, { ...g, offset: a.offset }) : removeGuideOp(store, g);
        } else if (a.kind === 'undo' && done.length > 0) {
          const { op: last, before } = done.pop()!;
          const after = list;
          act(() => { last.invert().apply(null); });
          expect(byId(now())).toEqual(byId(before));
          undone.push({ op: last, after });
          t.count('undo');
          continue;
        } else if (a.kind === 'redo' && undone.length > 0) {
          const { op: last, after } = undone.pop()!;
          const before = list;
          act(() => { last.invert().invert().apply(null); });
          expect(byId(now())).toEqual(byId(after));
          done.push({ op: last, before });
          t.count('redo');
          continue;
        }
        if (!op) continue;
        const before = list;
        act(() => { op.apply(null); });
        done.push({ op, before });
        undone.length = 0;
        t.count(a.kind);
      }
      while (done.length > 0) {
        const { op, before } = done.pop()!;
        act(() => { op.invert().apply(null); });
        expect(byId(now())).toEqual(byId(before));
      }
      expect(now()).toEqual([]);
    }), RUNS);
    for (const what of ['add', 'move', 'remove', 'undo', 'redo']) t.atLeast(what, 10);
  }, TIMEOUT);

  it('hears no change when a guide is added again as it stands (shrunk counterexample)', () => {
    // A second add of an equal guide made a new list and told every subscriber.
    const r = setup();
    act(() => { r.hook.current.addGuide({ id: 'd', axis: 'x', offset: 19.875 }); });
    const list = r.hook.current.guides;
    const heard = r.heard.n;
    act(() => { r.hook.current.addGuide({ id: 'd', axis: 'x', offset: 19.875 }); });
    expect(r.heard.n).toBe(heard);
    expect(r.hook.current.guides).toBe(list);
  });
});

