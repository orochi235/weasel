import { useState, type ReactElement, type ReactNode } from 'react';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui';
import {
  formatAge,
  formatEnabled,
  type DispatchLogEntry,
  type TraceLogEntry,
} from './dispatchTraceLog';
import s from './DispatchTraceTable.module.css';

const DISPLAY_LIMIT = 100;

export interface DispatchTraceTableProps {
  entries: readonly TraceLogEntry[];
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

type Candidate = DispatchLogEntry['candidates'][number] & { id: string };

/** The newest 100 trace entries, newest first. Clicking a dispatch row opens
 *  its candidate actions and why each was or wasn't chosen. */
export function DispatchTraceTable({
  entries,
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

  const columns: readonly DataGridColumn<TraceRow>[] = [
    {
      id: 'age',
      header: 'Age',
      sortable: false,
      className: s.age,
      render: ({ entry }) => formatAge(Math.max(0, now - entry.ts)),
    },
    { id: 'event', header: 'Event', sortable: false, render: ({ entry }) => renderEvent(entry) },
    { id: 'outcome', header: 'Outcome', sortable: false, render: ({ entry }) => renderOutcome(entry) },
    {
      id: 'cands',
      header: 'Cands',
      sortable: false,
      render: ({ entry }) => (entry.kind === 'mode' ? '—' : entry.candidates.length),
    },
  ];

  return (
    <DataGrid
      className={className}
      rows={rows}
      columns={columns}
      empty={empty}
      rowClassName={({ entry }) => (entry.kind === 'mode'
        ? s.mode
        : entry.outcome === 'unhandled' ? s.unhandled : undefined)}
      rowExpandable={({ entry }) => entry.kind === 'dispatch'}
      expandedIds={expanded}
      onExpandedChange={setExpanded}
      onRowClick={({ id, entry }) => {
        if (entry.kind !== 'dispatch') return;
        setExpanded((cur) => (cur.has(id) ? new Set() : new Set([id])));
      }}
      renderDetail={({ entry }) => (entry.kind === 'dispatch' ? <CandidateDetail entry={entry} /> : null)}
    />
  );
}

function CandidateDetail({ entry }: { entry: DispatchLogEntry }): ReactElement {
  if (entry.candidates.length === 0) return <em>No candidates considered.</em>;
  const rows: Candidate[] = entry.candidates.map((c, i) => ({ ...c, id: `${c.actionId}#${i}` }));
  return (
    <DataGrid
      rows={rows}
      columns={CANDIDATE_COLUMNS}
      rowClassName={(c) => (c.actionId === entry.fired ? s.fired : undefined)}
    />
  );
}

const CANDIDATE_COLUMNS: readonly DataGridColumn<Candidate>[] = [
  { id: 'actionId', header: 'Action', sortable: false, render: (c) => <code>{c.actionId}</code> },
  { id: 'scope', header: 'Scope', sortable: false },
  { id: 'enabled', header: 'Enabled', sortable: false, render: (c) => formatEnabled(c.enabledResult) },
];

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
      {entry.eventKind}
      {entry.key !== undefined ? <> <code>{entry.key === ' ' ? 'Space' : entry.key}</code></> : null}
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
