import { createHistory, createSwapOp, type History, type SwapArgs } from '@weasel-js/history';
import { deepEqual } from '@weasel-js/registry';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { type LabHistoryStore, type SavedLabHistory, useSavedLabHistory } from './historyStorage';

/** The adapter the ops mutate: one slot holding the whole editor state. */
interface Holder<T> {
  value: T;
}

/** The name a step goes by in a saved history. */
const SWAP_OP = 'theme-editor:swap';

/** A whole-state step: the editor's state is small enough to replace wholesale, so every control gets undo
 *  without an op per field. `coalesceKey` merges a drag's ticks into one step. */
function stateSwap<T>(holder: Holder<T>, { before, after }: SwapArgs<T>, label: string, coalesceKey?: string) {
  return createSwapOp({ name: SWAP_OP, label, before, after, coalesceKey, emit: (value) => { holder.value = value; } });
}

const sameJson = (a: unknown, b: unknown) => deepEqual(a, b, { undefinedAsAbsent: true });

/** How many undo steps take `saved` back to `state`; null when none does. */
function stepsBackTo<T>(saved: SavedLabHistory<T>, state: T): number | null {
  if (sameJson(saved.state, state)) return 0;
  const stack = saved.history.undoStack;
  for (let n = 1; n <= stack.length; n += 1) {
    const first = stack[stack.length - n]!.forwardOps[0];
    if (first?.name === SWAP_OP && sameJson((first.args as SwapArgs<T>).before, state)) return n;
  }
  return null;
}

/** How many steps a history keeps. */
const HISTORY_LIMIT = 200;

export interface LabHistory<T> {
  state: T;
  /** Replace the state. `key` groups a drag into one undo entry. */
  update: (next: T, key: string, label?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  history: History;
}

/**
 * Undo/redo over a single state object, on the kit's history engine rather
 * than a local stack — same coalescing, same semantics as everywhere else.
 * Given a `store`, the history is saved as it changes and restored at mount,
 * when it passes through the state the hook opens with.
 */
export function useLabHistory<T>(initial: T, store?: LabHistoryStore<T>): LabHistory<T> {
  const holder = useRef<Holder<T>>({ value: initial });
  const kept = useRef(store);
  const history = useMemo(() => {
    const created = createHistory(holder.current, {
      // Long enough that a drag reads as one gesture, short enough that two
      // deliberate edits stay separate.
      coalesceWindowMs: 500,
      historyLimit: HISTORY_LIMIT,
      rebuildOp: (name, args, { entry }) => (name === SWAP_OP ? stateSwap(holder.current, args as SwapArgs<T>, entry.label) : null),
    });
    // One saved past the state this opens on (a draft the caller would not keep) steps back to it, leaving the later
    // steps to redo. One that never passed through it would step from values that are not on screen, and is dropped.
    const saved = kept.current?.load();
    const back = saved ? stepsBackTo(saved, holder.current.value) : null;
    if (saved && back !== null) {
      // A strict restore that cannot rebuild a step leaves the history empty, as no save would.
      try {
        created.restore(saved.history);
        for (let n = 0; n < back; n += 1) created.undo();
      } catch {}
    }
    return created;
  }, []);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => history.subscribe(rerender), [history]);
  useSavedLabHistory(history, holder, kept.current);

  const update = useCallback(
    (next: T, key: string, label = key) => {
      if (Object.is(holder.current.value, next)) return;
      history.apply(stateSwap(holder.current, { before: holder.current.value, after: next }, label, key), label);
    },
    [history],
  );

  const undo = useCallback(() => history.undo(), [history]);
  const redo = useCallback(() => history.redo(), [history]);

  return {
    state: holder.current.value,
    update,
    undo,
    redo,
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
    history,
  };
}
