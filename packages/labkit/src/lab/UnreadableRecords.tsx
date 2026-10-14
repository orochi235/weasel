import { useContext } from 'react';
import { useStore } from 'zustand/react';
import { Button } from '../passthrough/weasel-ui';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import type { UnreadableRecord } from '../state/types';

const KIND: Record<UnreadableRecord['kind'], string> = { trial: 'Trial', snapshot: 'Snapshot' };

function describe({ kind, id, label, instrumentName }: UnreadableRecord): string {
  return `${KIND[kind]} "${label ?? id}" (${instrumentName})`;
}

function Rows({ store }: { store: LabStore }) {
  const unreadable = useStore(store, (s) => s.unreadable);
  if (unreadable.length === 0) return null;
  return (
    <ul className="lk-unreadable" aria-label="Stored records that failed to load">
      {unreadable.map((record) => (
        <li key={`${record.kind}:${record.id}`} className="lk-unreadable__row">
          <span className="lk-unreadable__what">
            {describe(record)} failed to load and is left out: {record.reason}
          </span>
          <Button
            size="sm"
            ariaLabel={`Discard ${describe(record)}`}
            onClick={() => store.getState().discardUnreadable(record.kind, record.id)}
          >
            Discard
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The stored trials and snapshots the lab could not load, each with the one
 * thing that can be done about it here: delete its record. Renders nothing
 * while every record loaded, and outside a lab store.
 */
export function UnreadableRecords() {
  const ctx = useContext(LabStoreContext);
  return ctx ? <Rows store={ctx.store} /> : null;
}
