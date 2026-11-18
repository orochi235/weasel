import { createHistory, createSwapOp, type History } from '@weasel-js/history';
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

/** Held for a leaf the store holds nothing of. */
const UNSET = Symbol('unset');

/** What changed between `prev` and `next`: each leaf that differs, before and after, `UNSET` where nothing is held. */
function changes(prev: Held, next: Held, paths: readonly string[]): { before: Held; after: Held } {
  const before = new Map<string, unknown>();
  const after = new Map<string, unknown>();
  for (const path of paths) {
    const was = prev.has(path) ? prev.get(path) : UNSET;
    const is = next.has(path) ? next.get(path) : UNSET;
    if (deepEqual(was, is)) continue;
    before.set(path, was);
    after.set(path, is);
  }
  return { before, after };
}

/** Make `store` hold each of `target`'s leaves as it says, leaving every other leaf as it is. */
function restoreHeld(store: PrefsStore<PrefGroup>, paths: readonly string[], target: Held): void {
  const now = heldOf(store, paths);
  for (const [path, want] of target) {
    const key = path as PrefPath<PrefGroup>;
    if (want === UNSET) {
      if (now.has(path)) store.reset(path);
    } else if (want === AUTO) {
      if (now.get(path) !== AUTO) store.setAuto(key, true);
    } else if (!now.has(path) || !deepEqual(now.get(path), want)) {
      store.set(key, want as never);
    }
  }
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
      // Only the leaves this write changed, so an undo leaves a write made since by anything else alone.
      const { before, after } = changes(prev, heldOf(store, paths), paths);
      if (before.size === 0) return;
      // The apply finds the write already made, and writes nothing.
      history.apply(createSwapOp({
        name: 'theme-prefs:held', label, before, after, coalesceKey: key, emit: (held) => restoreHeld(store, paths, held),
      }), label);
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
