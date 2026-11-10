import { historyKey } from '@weasel-js/core';
import { createHistory, type History, type Op } from '@weasel-js/history';
import { deepEqual } from '@weasel-js/registry';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { type LabHistoryStore, useSavedLabHistory } from './historyStorage';

/** The adapter the ops mutate: one slot holding the whole editor state. */
interface Holder<T> {
  value: T;
}

/** The name a snapshot goes by in a saved history. */
const SNAPSHOT_OP = 'theme-editor:snapshot';

interface SnapshotArgs<T> {
  prev: T;
  next: T;
  coalesceKey: string;
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
function snapshotOp<T>(args: SnapshotArgs<T>): Op {
  const { prev, next, coalesceKey } = args;
  return {
    name: SNAPSHOT_OP,
    args,
    apply(adapter: unknown) {
      const holder = adapter as Holder<T>;
      if (Object.is(holder.value, next)) return 'noop';
      holder.value = next;
      return undefined;
    },
    invert: () => snapshotOp({ prev: next, next: prev, coalesceKey }),
    coalesceKey,
  };
}

const rebuildSnapshot = (name: string, args: unknown): Op | null =>
  name === SNAPSHOT_OP ? snapshotOp(args as SnapshotArgs<unknown>) : null;

const sameJson = (a: unknown, b: unknown) => deepEqual(a, b, { undefinedAsAbsent: true });

/** How many steps a history keeps. */
const HISTORY_LIMIT = 200;

/** The input types that carry a browser undo stack of their own. A bare `<input>` is one. */
const TEXT_INPUT = /^(?:|text|search|url|email|tel|password|number)$/;

function editsText(element: HTMLElement | null): boolean {
  if (!element) return false;
  if (element.isContentEditable || element.tagName === 'TEXTAREA') return true;
  return element.tagName === 'INPUT' && TEXT_INPUT.test((element as HTMLInputElement).type.toLowerCase());
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
 * Given a `store`, the history is saved as it changes and restored at mount,
 * when it ends on the state the hook opens with.
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
      rebuildOp: rebuildSnapshot,
    });
    // One saved against other state would step from values that are not on screen.
    const saved = kept.current?.load();
    if (saved && sameJson(saved.state, holder.current.value)) created.restore(saved.history);
    return created;
  }, []);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => history.subscribe(rerender), [history]);
  useSavedLabHistory(history, holder, kept.current);

  const update = useCallback(
    (next: T, key: string, label = key) => {
      history.apply(snapshotOp({ prev: holder.current.value, next, coalesceKey: key }), label);
    },
    [history],
  );

  const undo = useCallback(() => history.undo(), [history]);
  const redo = useCallback(() => history.redo(), [history]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A text field owns its own undo; don't steal it. Every other control — a
      // range, a checkbox, a swatch — has none, and holds the focus right after
      // the edit you meant to undo.
      if (editsText(e.target as HTMLElement | null)) return;
      const step = historyKey(e);
      if (!step) return;
      e.preventDefault();
      if (step === 'redo') history.redo();
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
