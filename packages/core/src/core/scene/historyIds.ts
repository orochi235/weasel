/** The node ids a serialized history adds or removes: ones a restored undo or redo can bring back. */
import type { SerializedHistory, SerializedHistoryEntry } from '@weasel-js/history';
import { revertName } from './opTable';

const ADDS = new Set(['kit:add', revertName('kit:add')]);
const REMOVES = new Set(['kit:remove', revertName('kit:remove')]);

export function idsNamedBy(snapshot: SerializedHistory): Set<string> {
  const ids = new Set<string>();
  const read = (entries: readonly SerializedHistoryEntry[]) => {
    for (const e of entries) {
      for (const op of [...e.forwardOps, ...e.baseOps]) {
        const args = op.args as { id?: unknown; nodes?: readonly { id?: unknown }[] } | null;
        if (args === null || typeof args !== 'object') continue;
        if (ADDS.has(op.name) && typeof args.id === 'string') ids.add(args.id);
        if (REMOVES.has(op.name)) for (const n of args.nodes ?? []) if (typeof n.id === 'string') ids.add(n.id);
      }
    }
  };
  read(snapshot.undoStack);
  read(snapshot.redoStack);
  for (const b of snapshot.branches ?? []) read(b.entries);
  return ids;
}
