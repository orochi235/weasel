/** The trace as rows, newest first under the live prediction; a dispatch row opens to the path it took and every stage behind it. */
import { useState, type ReactElement, type ReactNode } from 'react';
import type { DispatchRecord, TraceLogEntry } from '@weasel-js/core/routing';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { FallthroughDiagram } from '@weasel-js/ui/components/FallthroughDiagram';
import { DecisionPath } from './DecisionPath';
import { formatAge } from './formatAge';
import s from './TraceTable.module.css';

const DISPLAY_LIMIT = 100;
const LIVE_ID = 'live';

export interface TraceTableProps {
  entries: readonly TraceLogEntry[];
  /** A press at the pointer, predicted, pinned above the log. */
  live: DispatchRecord | null;
  /** The clock each row's age is measured against. */
  now: number;
  /** Inputs an action handled, with mode switches. */
  showHandled: boolean;
  showUnhandled: boolean;
  /** Shown in place of rows when the filters leave none. */
  empty: ReactNode;
}

interface TraceRow { id: string; entry: TraceLogEntry }

/** Ids from each entry's timestamp, numbering entries that share one. */
function withTsIds(entries: readonly TraceLogEntry[]): TraceRow[] {
  const seen = new Map<number, number>();
  return entries.map((entry) => {
    const n = seen.get(entry.ts) ?? 0;
    seen.set(entry.ts, n + 1);
    return { id: n === 0 ? String(entry.ts) : `${entry.ts}#${n}`, entry };
  });
}

function renderEvent(entry: TraceLogEntry): ReactNode {
  if (entry.kind === 'mode') {
    return <><code>{entry.mode}</code>{entry.detail ? <span className={s.modeDetail}> ({entry.detail})</span> : null}</>;
  }
  const { key } = entry.input;
  return <>{entry.input.eventKind}{key !== undefined ? <> <code>{key === ' ' ? 'Space' : key}</code></> : null}</>;
}

function renderOutcome(entry: TraceLogEntry): ReactNode {
  if (entry.kind === 'mode') return <><code>{entry.from ?? '∅'}</code> → <code>{entry.to ?? '∅'}</code></>;
  if (entry.outcome === 'unhandled') return 'unhandled';
  return entry.fired ? <code>{entry.fired}</code> : 'handled';
}

export function TraceTable({ entries, live, now, showHandled, showUnhandled, empty }: TraceTableProps): ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const rows = withTsIds(entries)
    .filter(({ entry: e }) => (e.kind === 'mode' || e.outcome === 'handled' ? showHandled : showUnhandled))
    .slice(-DISPLAY_LIMIT)
    .reverse();
  if (live) rows.unshift({ id: LIVE_ID, entry: live });

  const columns: readonly DataGridColumn<TraceRow>[] = [
    {
      id: 'age',
      header: 'Age',
      sortable: false,
      className: s.age,
      render: ({ id, entry }) => (id === LIVE_ID ? 'live' : formatAge(Math.max(0, now - entry.ts))),
    },
    { id: 'event', header: 'Event', sortable: false, render: ({ entry }) => renderEvent(entry) },
    { id: 'outcome', header: 'Outcome', sortable: false, render: ({ entry }) => renderOutcome(entry) },
    {
      id: 'matched',
      header: 'Matched',
      sortable: false,
      className: s.count,
      render: ({ entry }) => (entry.kind === 'mode' ? '—' : entry.matched.length),
    },
  ];

  return (
    <DataGrid
      className={s.table}
      rows={rows}
      columns={columns}
      empty={empty}
      rowClassName={({ id, entry }) => (id === LIVE_ID
        ? s.live
        : entry.kind === 'mode' ? s.mode : entry.outcome === 'unhandled' ? s.unhandled : undefined)}
      rowExpandable={({ entry }) => entry.kind === 'dispatch'}
      expandedIds={expanded}
      onExpandedChange={setExpanded}
      onRowClick={({ id, entry }) => {
        if (entry.kind !== 'dispatch') return;
        setExpanded((cur) => (cur.has(id) ? new Set() : new Set([id])));
      }}
      renderDetail={({ entry }) => (entry.kind === 'dispatch'
        ? <div className={s.detail}><DecisionPath record={entry} /><FallthroughDiagram record={entry} /></div>
        : null)}
    />
  );
}
