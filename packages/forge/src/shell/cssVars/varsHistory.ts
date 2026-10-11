import { createHistory, type SerializedHistory, type SwapArgs, swapOp, useLatest } from '@weasel-js/core';
import { type TokenScale, usePersistedState, useTrialId } from '@weasel-js/labkit';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { CssOverrides } from './overrides';

/** What an edit in the panel changes: the trial's overrides, and the scale each group's were generated from. */
export interface VarsState {
  readonly overrides: CssOverrides;
  readonly scales: Readonly<Record<string, TokenScale>>;
}

const SWAP = 'fg.vars.swap';
/** Edits this close together under one key undo as one, so typing a value is one step. */
const COALESCE_MS = 800;
/** The history is kept with the trial, so it is held to a count. */
const LIMIT = 100;

export interface VarsHistory {
  /** The state as the last edit or step left it, ahead of the render that shows it. */
  current(): VarsState;
  /** Put `next` in force as one step back. Commits in one tick are one step, as are those sharing a `key` close together. */
  commit(next: VarsState, key: string): void;
  step(to: 'undo' | 'redo'): void;
  canUndo: boolean;
  canRedo: boolean;
  /** Put `next` in force and forget every step: nothing before it can be gone back to. */
  reset(next: VarsState): void;
}

/**
 * The undo history of the CSS variable edits of the trial this is rendered inside, kept with the trial so it
 * outlives a reload. `apply` puts a state in force, given the one it replaces.
 */
export function useVarsHistory(state: VarsState, apply: (from: VarsState, to: VarsState) => void): VarsHistory {
  const trialId = useTrialId();
  const [stored, setStored] = usePersistedState<SerializedHistory | null>('fg-css-vars-history', null, { scope: 'trial' });
  const rendered = useLatest(state);
  // What an edit left, until the render that shows it: a second edit in the same tick starts from here.
  const ahead = useRef<VarsState | null>(null);
  useEffect(() => {
    ahead.current = null;
  }, [state]);
  const current = () => ahead.current ?? rendered.current;
  const latestApply = useLatest(apply);
  const emit = (to: VarsState) => {
    const from = current();
    ahead.current = to;
    latestApply.current(from, to);
  };
  const swap = (before: VarsState, after: VarsState, coalesceKey?: string) =>
    swapOp({ name: SWAP, label: 'edit vars', before, after, emit, ...(coalesceKey !== undefined ? { coalesceKey } : {}) });

  const history = useMemo(() => {
    const opened = createHistory(null, {
      coalesceWindowMs: COALESCE_MS,
      historyLimit: LIMIT,
      rebuildOp: (name, args) => {
        const { before, after } = args as SwapArgs<VarsState>;
        return name === SWAP ? swap(before, after) : null;
      },
    });
    if (stored) opened.restore(stored);
    return opened;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a trial's history is opened once, from what was kept with it
  }, [trialId]);
  useSyncExternalStore(history.subscribe, history.getVersion);
  const keep = () => setStored(history.canUndo() || history.canRedo() ? history.serialize() : null);

  // The key of the tick's first commit, which the rest of the tick's commits take so they merge into it.
  const tick = useRef<string | null>(null);

  return {
    current,
    commit(next, key) {
      if (tick.current === null) {
        tick.current = key;
        queueMicrotask(() => {
          tick.current = null;
        });
      }
      history.applyOps([swap(current(), next, tick.current)], 'edit vars');
      keep();
    },
    step(to) {
      history[to]();
      keep();
    },
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
    reset(next) {
      emit(next);
      history.clear();
      setStored(null);
    },
  };
}
