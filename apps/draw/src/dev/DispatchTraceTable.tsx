import { useState, type ReactElement, type ReactNode } from 'react';
import { DataGrid, FallthroughDiagram, type DataGridColumn } from '@weasel-js/ui';
import { formatAge, type DispatchRecord, type TraceLogEntry } from './dispatchTraceLog';
import s from './DispatchTraceTable.module.css';

const DISPLAY_LIMIT = 100;

export interface DispatchTraceTableProps {
  entries: readonly TraceLogEntry[];
  /** A predicted press at the pointer, pinned above the log as the Live row. */
  live?: DispatchRecord | null;
  /** Wall clock the Age column is measured against. */
  now: number;
  /** Include dispatches no action handled, and those one did. Mode switches
   *  ride with the handled stream. */
  showHandled?: boolean;
  showUnhandled?: boolean;
  /** Shown in place of rows when the filters leave nothing. */
  empty?: ReactNode;
  className?: string;
}

interface TraceRow { id: string; entry: TraceLogEntry }

const LIVE_ID = 'live';

/** The newest 100 trace entries, newest first, under an optional Live row.
 *  Clicking a dispatch row opens its fallthrough diagram. */
export function DispatchTraceTable({
  entries,
  live,
  now,
  showHandled = true,
  showUnhandled = false,
  empty,
  className,
}: DispatchTraceTableProps): ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const rows = withTsIds(entries)
    .filter(({ entry: e }) => {
      if (e.kind === 'mode') return showHandled;
      return e.outcome === 'unhandled' ? showUnhandled : showHandled;
    })
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
      id: 'cands',
      header: 'Matched',
      sortable: false,
      className: s.count,
      render: ({ entry }) => (entry.kind === 'mode' ? '—' : entry.matched.length),
    },
  ];

  return (
    <DataGrid
      className={className}
      rows={rows}
      columns={columns}
      empty={empty}
      rowClassName={({ id, entry }) => (id === LIVE_ID
        ? s.live
        : entry.kind === 'mode'
          ? s.mode
          : entry.outcome === 'unhandled' ? s.unhandled : undefined)}
      rowExpandable={({ entry }) => entry.kind === 'dispatch'}
      expandedIds={expanded}
      onExpandedChange={setExpanded}
      onRowClick={({ id, entry }) => {
        if (entry.kind !== 'dispatch') return;
        setExpanded((cur) => (cur.has(id) ? new Set() : new Set([id])));
      }}
      renderDetail={({ entry }) => (entry.kind === 'dispatch' ? <FallthroughDiagram record={entry} /> : null)}
    />
  );
}

function renderEvent(entry: TraceLogEntry): ReactNode {
  if (entry.kind === 'mode') {
    return (
      <>
        <code>{entry.mode}</code>
        {entry.detail ? <span className={s.modeDetail}> ({entry.detail})</span> : null}
      </>
    );
  }
  return (
    <>
      {entry.input.eventKind}
      {entry.input.key !== undefined ? <> <code>{entry.input.key === ' ' ? 'Space' : entry.input.key}</code></> : null}
    </>
  );
}

function renderOutcome(entry: TraceLogEntry): ReactNode {
  if (entry.kind === 'mode') {
    return <><code>{entry.from ?? '∅'}</code> → <code>{entry.to ?? '∅'}</code></>;
  }
  if (entry.outcome === 'unhandled') return 'unhandled';
  return entry.fired ? <code>{entry.fired}</code> : 'handled';
}

/** Ids from each entry's timestamp, numbering entries that share one. */
function withTsIds(entries: readonly TraceLogEntry[]): TraceRow[] {
  const seen = new Map<number, number>();
  return entries.map((entry) => {
    const n = seen.get(entry.ts) ?? 0;
    seen.set(entry.ts, n + 1);
    return { id: n === 0 ? String(entry.ts) : `${entry.ts}#${n}`, entry };
  });
}
