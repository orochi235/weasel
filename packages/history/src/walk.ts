/**
 * Stepping a history's stacks: moving entries between undo and redo, and
 * applying what each move takes.
 */
import type { Op } from './op';
import type { Entry } from './serialized';
import type { HistorySelection } from './historyTypes';

/** The entries a walk moved, in the order moved, and what it applied for each. */
export interface Walked {
  walked: Entry[];
  applied: Op[][];
}

export interface WalkEnv {
  undoStack: Entry[];
  redoStack: Entry[];
  selection: HistorySelection | undefined;
  applyAllOrNothing(ops: Op[], settle?: () => Op[]): boolean;
  /** Throws when a journal's edits sit over the stack's top. */
  refuse(): void;
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

  /** Walk one entry backwards. The selection is restored *after* the
   *  inverted ops apply, so an entry that also carries a `setSelection`-style
   *  op can't overwrite the snapshot. */
  function stepBack(entry: Entry): Op[] {
    const leaving = readSelection();
    const coalesced = entry.forwardOps !== entry.baseOps;
    const inverses = invertEntry(entry);
    applyAllOrNothing(inverses, coalesced ? () => entry.forwardOps : undefined);
    if (leaving) entry.selectionAfter = leaving;
    if (selection && entry.selectionBefore) selection.set(entry.selectionBefore);
    return inverses;
  }

  /** Walk one entry forwards. Mirror of `stepBack`. */
  function stepForward(entry: Entry): void {
    const leaving = readSelection();
    const coalesced = entry.forwardOps !== entry.baseOps;
    applyAllOrNothing(entry.forwardOps, coalesced ? () => invertEntry(entry) : undefined);
    if (leaving) entry.selectionBefore = leaving;
    if (selection && entry.selectionAfter) selection.set(entry.selectionAfter);
  }

  /** Step until `n` entries are on the undo stack. An entry changes stacks
   *  only once its step has run, so a throw leaves both stacks describing
   *  the state as it is. */
  function walkTo(n: number): Walked {
    if (n !== undoStack.length) env.refuse();
    const walked: Entry[] = [];
    const applied: Op[][] = [];
    while (undoStack.length > n) {
      const entry = undoStack[undoStack.length - 1]!;
      applied.push(stepBack(entry));
      undoStack.pop();
      redoStack.push(entry);
      walked.push(entry);
    }
    while (undoStack.length < n && redoStack.length > 0) {
      const entry = redoStack[redoStack.length - 1]!;
      stepForward(entry);
      redoStack.pop();
      undoStack.push(entry);
      walked.push(entry);
      applied.push(entry.forwardOps);
    }
    return { walked, applied };
  }

  return { walkTo, readSelection };
}
