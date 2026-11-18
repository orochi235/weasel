/**
 * The read-only half of `History`: what a caller can ask of the two stacks
 * without changing them.
 */
import type { Op } from './op';
import { entryView } from './entryOps';
import { depthAt, timestampAt } from './stackTime';
import type { Entry } from './serialized';
import type { History } from './historyTypes';

export type StackView = Pick<
  History, 'canUndo' | 'canRedo' | 'undoDepth' | 'redoDepth' | 'entries' | 'timestampAt' | 'depthAt' | 'allForwardOps'
>;

export function createStackView(undoStack: readonly Entry[], redoStack: readonly Entry[]): StackView {
  return {
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    undoDepth: () => undoStack.length,
    redoDepth: () => redoStack.length,
    entries() {
      // redoStack is internally stored newest-on-top (so `pop()` redoes the
      // next-most-recent undo). Reverse on the way out so callers see the
      // entries in chronological order — the user's next redo is the first
      // element, matching `entries().redo[0]` semantics.
      return {
        undo: undoStack.map(entryView),
        redo: [...redoStack].reverse().map(entryView),
      };
    },
    timestampAt: (i) => timestampAt(undoStack, redoStack, i),
    depthAt: (t) => depthAt(undoStack, redoStack, t),
    allForwardOps(): Op[] {
      const out: Op[] = [];
      for (const e of undoStack) {
        for (const op of e.forwardOps) out.push(op);
      }
      return out;
    },
  };
}
