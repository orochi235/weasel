import type { History, SerializedHistory } from '@weasel-js/core';
import { maxOf } from '@weasel-js/geom';
import { latestStamp } from '../state/savedUndo';
import { editStamp, seedEditStamp } from './editStamp';

type Stamped = Pick<History, 'observe' | 'entries'>;

/**
 * Stamps each entry `history` records or merges into with `editStamp`, by id, into `stamps`, so its steps
 * order against the trial's marks to the fraction of a millisecond where the history's own timestamps are
 * whole ones. Returns the stop.
 */
export function stampEdits(history: Stamped, stamps: Map<number, number>): () => void {
  return history.observe((step) => {
    if (step.kind !== 'push' && step.kind !== 'coalesce') return;
    for (const entry of step.entries) stamps.set(entry.id, editStamp());
    const { undo, redo } = history.entries();
    // Entries the history let go of (dropped redo, its limit) take their stamps with them.
    if (stamps.size > 2 * (undo.length + redo.length) + 16) {
      const held = new Set([...undo, ...redo].map((e) => e.id));
      for (const id of stamps.keys()) if (!held.has(id)) stamps.delete(id);
    }
  });
}

/** When the step `side` would take was recorded: its stamp from `stamps`, else the history's own timestamp. */
export function stampOf(
  history: Pick<History, 'entries'>,
  stamps: ReadonlyMap<number, number>,
  side: 'undo' | 'redo',
): number | undefined {
  const { undo, redo } = history.entries();
  const entry = side === 'undo' ? undo[undo.length - 1] : redo[0];
  return entry && (stamps.get(entry.id) ?? entry.timestamp);
}

/** Put back the stamps saved beside `saved`, and hand out later ones from now on. */
export function restoreStamps(
  stamps: Map<number, number>,
  saved: readonly [number, number][] | undefined,
  history: SerializedHistory,
): void {
  stamps.clear();
  for (const [id, stamp] of saved ?? []) stamps.set(id, stamp);
  seedEditStamp(Math.max(maxOf(stamps.values()), latestStamp(history)));
}
