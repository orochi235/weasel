import { createHistory, type History, type Op } from '@weasel-js/history';
import { prefLeaves, type PrefGroup, type PrefPath, type PrefSelection, type PrefsStore } from '@weasel-js/prefs';
import { deepEqual } from '@weasel-js/registry';
import { useMemo } from 'react';

/** Held for a leaf that is auto where its schema starts it pinned: a mark, not a value. */
const AUTO = Symbol('auto');

/** What a store holds of its own, by leaf path: a split leaf's whole scope, any other leaf's value, or `AUTO`. */
type Held = ReadonlyMap<string, unknown>;

function heldOf(store: PrefsStore<PrefGroup>, paths: readonly string[]): Held {
  const unset = store.unset();
  const held = new Map<string, unknown>();
  for (const path of paths) {
    if (unset.has(path)) continue;
    const key = path as PrefPath<PrefGroup>;
    held.set(path, store.isAuto(key) ? AUTO : (store.scope(key) ?? store.get(key)));
  }
  return held;
}

/** Make `store` hold `target` and nothing else, writing only the leaves that differ. */
function restoreHeld(store: PrefsStore<PrefGroup>, paths: readonly string[], target: Held): void {
  const now = heldOf(store, paths);
  for (const path of paths) {
    const key = path as PrefPath<PrefGroup>;
    const want = target.get(path);
    if (!target.has(path)) {
      if (now.has(path)) store.reset(path);
    } else if (want === AUTO) {
      if (now.get(path) !== AUTO) store.setAuto(key, true);
    } else if (!now.has(path) || !deepEqual(now.get(path), want)) {
      store.set(key, want as never);
    }
  }
}

function heldOp(store: PrefsStore<PrefGroup>, paths: readonly string[], prev: Held, next: Held, coalesceKey: string): Op {
  return {
    name: 'theme-prefs:held',
    args: { coalesceKey },
    // The first apply finds the write already made, and writes nothing.
    apply: () => restoreHeld(store, paths, next),
    invert: () => heldOp(store, paths, next, prev, coalesceKey),
    coalesceKey,
  };
}

/** The writes `PrefsForm` makes, each an undo step on `history`; a burst on one path is one step. */
export interface PrefsHistory {
  history: History;
  set: (path: string, value: unknown) => void;
  setAt: (path: string, value: unknown, at: PrefSelection) => void;
  setAuto: (path: string, next: boolean) => void;
  reset: (path?: string) => void;
}

/** Undo and redo over `store`'s writes, stepping what it holds back and forth. */
export function usePrefsHistory(store: PrefsStore<PrefGroup>): PrefsHistory {
  return useMemo(() => {
    const paths = [...prefLeaves(store.schema).keys()];
    // Long enough that a drag or typing reads as one edit, short enough that two deliberate edits stay apart.
    const history = createHistory(store, { coalesceWindowMs: 500 });
    const write = (key: string, label: string, run: () => void): void => {
      const prev = heldOf(store, paths);
      run();
      const next = heldOf(store, paths);
      if (deepEqual(Object.fromEntries(prev), Object.fromEntries(next))) return;
      history.apply(heldOp(store, paths, prev, next, key), label);
    };
    return {
      history,
      set: (path, value) => write(path, `set ${path}`, () => store.set(path as PrefPath<PrefGroup>, value as never)),
      setAt: (path, value, at) =>
        write(path, `set ${path}`, () => store.set(path as PrefPath<PrefGroup>, value as never, { at })),
      setAuto: (path, next) =>
        write(`auto:${path}`, `${next ? 'unpin' : 'pin'} ${path}`, () => store.setAuto(path as PrefPath<PrefGroup>, next)),
      reset: (path) => write(`reset:${path ?? ''}`, `reset ${path ?? 'all'}`, () => store.reset(path)),
    };
  }, [store]);
}
