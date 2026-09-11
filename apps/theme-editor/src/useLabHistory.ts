import { createHistory, type History, type Op } from '@weasel-js/history';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

/** The adapter the ops mutate: one slot holding the whole editor state. */
interface Holder<T> {
  value: T;
}

/**
 * A whole-state snapshot as an invertible op.
 *
 * The editor's state is a handful of numbers, so replacing it wholesale costs
 * nothing and every control gets undo without writing an op per field. What
 * earns its keep is `coalesceKey`: a slider drag pushes one entry per tick,
 * and the history engine merges them while keeping the first entry's `baseOps`,
 * so one undo steps back over the whole drag rather than forty.
 */
function snapshotOp<T>(prev: T, next: T, coalesceKey: string): Op {
  return {
    apply(adapter: unknown) {
      const holder = adapter as Holder<T>;
      if (Object.is(holder.value, next)) return 'noop';
      holder.value = next;
      return undefined;
    },
    invert: () => snapshotOp(next, prev, coalesceKey),
    coalesceKey,
  };
}

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
 */
export function useLabHistory<T>(initial: T): LabHistory<T> {
  const holder = useRef<Holder<T>>({ value: initial });
  const history = useMemo(
    // Long enough that a drag reads as one gesture, short enough that two
    // deliberate edits stay separate.
    () => createHistory(holder.current, { coalesceWindowMs: 500 }),
    [],
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => history.subscribe(rerender), [history]);

  const update = useCallback(
    (next: T, key: string, label = key) => {
      history.apply(snapshotOp(holder.current.value, next, key), label);
    },
    [history],
  );

  const undo = useCallback(() => history.undo(), [history]);
  const redo = useCallback(() => history.redo(), [history]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // A text field owns its own undo; don't steal it.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const accel = e.metaKey || e.ctrlKey;
      if (!accel || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) history.redo();
      else history.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history]);

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
