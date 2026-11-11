/**
 * Stateful property test of a trial's Undo and Redo over its two histories, its marks and its snapshots of state,
 * through `useTrialUndo`: random edits on either side, undos, and redos against a model of one history. Undo takes
 * back the latest step on either side, Redo makes again the earliest undone, and a new edit on either side drops
 * what Redo could make again on both. Checked after every command.
 */
import { act, renderHook } from '@testing-library/react';
import type { Op } from '@weasel-js/core';
import { createEmitter } from '@weasel-js/registry';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AnnotationsApi } from '../annotations/types';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { editStamp } from '../undo/editStamp';
import { trialUndoHistory } from './useRestoredHistory';
import { useTrialUndo } from './useTrialUndo';

const RUNS = 100;

/** A marks store as the trial reads one: a stack each way, stamped as the annotations stamp their steps. */
function fakeMarks() {
  const done: { id: number; at: number }[] = [];
  let undone: { id: number; at: number }[] = [];
  const changed = createEmitter();
  const store = {
    add(id: number) {
      done.push({ id, at: editStamp() });
      undone = [];
      changed.emit();
    },
    undo() {
      const step = done.pop();
      if (!step) return false;
      undone.unshift(step);
      changed.emit();
      return true;
    },
    redo() {
      const step = undone.shift();
      if (!step) return false;
      done.push(step);
      changed.emit();
      return true;
    },
    undoStamp: () => done.at(-1)?.at,
    redoStamp: () => undone[0]?.at,
    dropRedo() {
      if (undone.length === 0) return;
      undone = [];
      changed.emit();
    },
    subscribe: changed.subscribe,
    shown: () => done.map((s) => s.id),
    moves: {
      get undo() {
        return done.length > 0;
      },
      get redo() {
        return undone.length > 0;
      },
    },
  };
  return store;
}

/** An op that puts `id` on `applied`, and its inverse that takes it off. */
function pushOp(applied: number[], id: number): Op {
  const forward: Op = {
    label: 'edit',
    apply: () => {
      applied.push(id);
    },
    invert: () => ({
      label: 'edit',
      apply: () => {
        expect(applied.pop()).toBe(id);
      },
      invert: () => forward,
    }),
  };
  return forward;
}

type Side = 'mark' | 'step';

interface Model {
  done: { side: Side; id: number }[];
  undone: { side: Side; id: number }[];
  next: number;
}

interface Real {
  marks: ReturnType<typeof fakeMarks>;
  history: ReturnType<typeof trialUndoHistory>;
  applied: number[];
  bindings: () => { canUndo: boolean; canRedo: boolean; undo(): void; redo(): void } | undefined;
  rerender: () => void;
}

const t = tally();

function check(m: Model, r: Real): void {
  act(() => r.rerender());
  expect(r.marks.shown()).toEqual(m.done.filter((s) => s.side === 'mark').map((s) => s.id));
  expect(r.applied).toEqual(m.done.filter((s) => s.side === 'step').map((s) => s.id));
  expect(r.bindings()?.canUndo).toBe(m.done.length > 0);
  expect(r.bindings()?.canRedo).toBe(m.undone.length > 0);
}

class Edit implements fc.Command<Model, Real> {
  constructor(readonly side: Side) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const id = m.next++;
    if (m.undone.some((s) => s.side !== this.side)) t.count('dropped the other side’s redo');
    m.done.push({ side: this.side, id });
    m.undone = [];
    act(() => {
      if (this.side === 'mark') r.marks.add(id);
      else r.history.apply(pushOp(r.applied, id), 'edit');
    });
    check(m, r);
  }
  toString = (): string => `edit(${this.side})`;
}

class Undo implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>): boolean => m.done.length > 0;
  run(m: Model, r: Real): void {
    const step = m.done.pop();
    if (!step) return;
    if (m.done.some((s) => s.side !== step.side))
      t.count(`undid a ${step.side} over the other side`);
    m.undone.unshift(step);
    act(() => r.bindings()?.undo());
    check(m, r);
  }
  toString = (): string => 'undo';
}

class Redo implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>): boolean => m.undone.length > 0;
  run(m: Model, r: Real): void {
    const step = m.undone.shift();
    if (!step) return;
    if (m.undone.some((s) => s.side !== step.side))
      t.count(`redid a ${step.side} before the other side`);
    m.done.push(step);
    act(() => r.bindings()?.redo());
    check(m, r);
  }
  toString = (): string => 'redo';
}

const commands = [
  fc.constantFrom<Side>('mark', 'step').map((side) => new Edit(side)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
];

describe('a trial’s Undo and Redo over its marks and its snapshots', () => {
  it(
    'step the two as one history, ordered by when each step was made',
    () => {
      fc.assert(
        fc.property(fc.commands(commands, { maxCommands: 40, size: '+1' }), (cmds) => {
          const marks = fakeMarks();
          const history = trialUndoHistory(50);
          const applied: number[] = [];
          const hook = renderHook(() =>
            useTrialUndo({
              declaresUndo: true,
              marks: { moves: marks.moves, store: marks as unknown as AnnotationsApi },
              own: null,
              snapshots: history,
            }),
          );
          try {
            fc.modelRun(
              () => ({
                model: { done: [], undone: [], next: 0 },
                real: {
                  marks,
                  history,
                  applied,
                  bindings: () => hook.result.current,
                  rerender: () => hook.rerender(),
                },
              }),
              cmds,
            );
          } finally {
            hook.unmount();
          }
        }),
        runs(RUNS),
      );
      for (const what of [
        'dropped the other side’s redo',
        'undid a mark over the other side',
        'undid a step over the other side',
        'redid a mark before the other side',
        'redid a step before the other side',
      ])
        t.atLeast(what, 20);
    },
    timeoutFor(RUNS, 40),
  );
});
