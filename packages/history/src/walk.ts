/**
 * Stepping a history's stacks: moving entries between undo and redo, and
 * applying what each move takes.
 */
import type { Op } from './op';
import { textOf } from './textOf';
import type { Entry, HistoryLogger } from './serialized';
import type { HistorySelection, HistoryStep } from './historyTypes';
import { stepOf, type Settle } from './entryOps';

/** The entries a walk moved, in the order moved, and what it applied for each. */
export interface Walked {
  walked: Entry[];
  applied: Op[][];
}

export interface WalkEnv {
  undoStack: Entry[];
  redoStack: Entry[];
  selection: HistorySelection | undefined;
  applyAllOrNothing(ops: Op[], settle?: Settle): boolean;
  logger: HistoryLogger;
  /** Tells the history's listeners of a step. */
  report(step: HistoryStep): void;
}

export function createWalk(env: WalkEnv) {
  const { undoStack, redoStack, selection, applyAllOrNothing } = env;

  function invertEntry(entry: Entry): Op[] {
    return [...entry.baseOps].reverse().map((op) => op.invert());
  }

  /** Copy on read: the caller's array is theirs to mutate. */
  function readSelection(): readonly string[] | undefined {
    return selection ? [...selection.get()] : undefined;
  }

  /** The ops of `half` that `other` does not hold too: an op both share is restored by the unwind itself. */
  function ownOps(half: readonly Op[], other: readonly Op[]): Op[] {
    const shared = new Set(other);
    return half.filter((op) => !shared.has(op));
  }

  /** Apply what walking `entry` backwards takes, noting the selection it leaves. */
  function stepBack(entry: Entry): Op[] {
    const leaving = readSelection();
    const coalesced = entry.forwardOps !== entry.baseOps;
    const inverses = invertEntry(entry);
    applyAllOrNothing(inverses, coalesced ? { ops: ownOps(entry.forwardOps, entry.baseOps), inverted: false } : undefined);
    if (leaving) entry.selectionAfter = leaving;
    return inverses;
  }

  /** Mirror of `stepBack`. */
  function stepForward(entry: Entry): void {
    const leaving = readSelection();
    const coalesced = entry.forwardOps !== entry.baseOps;
    applyAllOrNothing(entry.forwardOps, coalesced ? { ops: ownOps(entry.baseOps, entry.forwardOps).reverse(), inverted: true } : undefined);
    if (leaving) entry.selectionBefore = leaving;
  }

  /** Step until `n` entries are on the undo stack, recording each move in `into`. An entry changes
   *  stacks once its ops have applied and before its selection is restored, so a throw from either
   *  leaves both stacks describing the state as it is, and `into` what moved. The selection is
   *  restored after the ops, so an entry that also carries a `setSelection`-style op can't overwrite it. */
  function walkTo(n: number, into: Walked = { walked: [], applied: [] }): Walked {
    while (undoStack.length > n) {
      const entry = undoStack[undoStack.length - 1]!;
      const inverses = stepBack(entry);
      undoStack.pop();
      redoStack.push(entry);
      into.walked.push(entry);
      into.applied.push(inverses);
      if (selection && entry.selectionBefore) selection.set(entry.selectionBefore);
    }
    while (undoStack.length < n && redoStack.length > 0) {
      const entry = redoStack[redoStack.length - 1]!;
      stepForward(entry);
      redoStack.pop();
      undoStack.push(entry);
      into.walked.push(entry);
      into.applied.push(entry.forwardOps);
      if (selection && entry.selectionAfter) selection.set(entry.selectionAfter);
    }
    return into;
  }

  /** Walk to `n`, or, when that throws, back to where the walk began rather
   *  than stopping partway, and rethrow. A second throw on the way back is
   *  logged: the stacks still match the state, at whatever depth that walk
   *  reached. Both walks record into `into`, in the order they ran. */
  function walkOrReturn(n: number, into: Walked): void {
    const start = undoStack.length;
    try {
      walkTo(n, into);
    } catch (err) {
      try {
        walkTo(start, into);
      } catch (back) {
        env.logger.warn(`goto: returning to depth ${start} threw: ${textOf(back)}`);
      }
      throw err;
    }
  }

  /** Run a walk and report what it applied whenever it leaves the stacks somewhere new, a throw
   *  partway through included. */
  function reported(kind: 'undo' | 'redo' | 'goto', walk: (into: Walked) => void): void {
    const start = undoStack.length;
    const into: Walked = { walked: [], applied: [] };
    try {
      walk(into);
    } finally {
      if (undoStack.length !== start) env.report(stepOf(kind, into.walked, into.applied));
    }
  }

  return { walkTo, walkOrReturn, reported, readSelection };
}
