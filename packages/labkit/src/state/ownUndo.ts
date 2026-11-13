import type { TrialHistorySource } from '../trial/trialHistory';
import type { LabStore } from './store';
import { onTrialRestart } from './trialRestarts';

interface Held {
  /** The history each trial's instrument has mounted now. */
  sources: Map<string, TrialHistorySource>;
  /** What each trial's last unmounted history saved, until another mounts or the trial restarts
   *  its undo, with the stop of the restart listener that drops it. */
  parked: Map<string, { data: unknown; off: () => void }>;
  listeners: Set<(trialId: string) => void>;
}

const byStore = new WeakMap<object, Held>();
let restoring = 0;

function held(store: object): Held {
  const known = byStore.get(store);
  if (known) return known;
  const fresh: Held = { sources: new Map(), parked: new Map(), listeners: new Set() };
  byStore.set(store, fresh);
  return fresh;
}

function unpark(h: Held, trialId: string): void {
  h.parked.get(trialId)?.off();
  h.parked.delete(trialId);
}

/** What a source's subscribers hear that its saved form could change on: a
 *  scene notifies on every frame of a drag, which moves no step. */
function stepKey(source: TrialHistorySource): string {
  return `${source.canUndo()}:${source.canRedo()}:${source.undoStamp?.()}:${source.redoStamp?.()}`;
}

/**
 * Holds `source` as the history trial `trialId` of `store` saves for its
 * instrument, and tells `onOwnUndoStep`'s listeners each time it steps.
 * Returns the release, which keeps what it saved last for the next save while
 * the trial stays open.
 */
export function holdOwnUndo(
  store: LabStore,
  trialId: string,
  source: TrialHistorySource,
): () => void {
  const h = held(store);
  h.sources.set(trialId, source);
  unpark(h, trialId);
  let key = stepKey(source);
  const off = source.subscribe(() => {
    const next = stepKey(source);
    if (next === key) return;
    key = next;
    if (restoring > 0) return;
    for (const listener of [...h.listeners]) listener(trialId);
  });
  return () => {
    off();
    if (h.sources.get(trialId) !== source) return;
    h.sources.delete(trialId);
    if (!source.serialize || !store.getState().trials.some((t) => t.id === trialId)) return;
    const offRestart = onTrialRestart(store, trialId, () => unpark(h, trialId));
    h.parked.set(trialId, { data: source.serialize(), off: offRestart });
  };
}

/** What trial `trialId` saves of its instrument's history: `{ data }` from a
 *  history held for it now or last, `data` undefined where that history
 *  cannot be saved; undefined where none has been held. */
export function ownUndoOf(store: object, trialId: string): { data: unknown } | undefined {
  const h = byStore.get(store);
  const source = h?.sources.get(trialId);
  if (source) return { data: source.serialize?.() };
  const parked = h?.parked.get(trialId);
  return parked && { data: parked.data };
}

/** Hear each time a history held for one of `store`'s trials steps. Returns the stop. */
export function onOwnUndoStep(store: object, listener: (trialId: string) => void): () => void {
  const h = held(store);
  h.listeners.add(listener);
  return () => h.listeners.delete(listener);
}

/** Run `restore` without telling the listeners: what it restores is already saved. */
export function restoringOwnUndo(restore: () => void): void {
  restoring += 1;
  try {
    restore();
  } finally {
    restoring -= 1;
  }
}
