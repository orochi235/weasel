/** History steps as rows, newest first, each keyed by its place in the page's ring; a row opens to the entries it touched
 *  and each entry's ops. */
import { useState, type ReactElement } from 'react';
import type { DevtoolsHistoryRecord } from '../protocol';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { formatAge } from './formatAge';
import type { Sequenced } from './sequenced';
import { ValueView } from './ValueView';
import s from './HistoryView.module.css';

const DISPLAY_LIMIT = 100;

interface StepRow { id: string; step: DevtoolsHistoryRecord }

/** How the tab names an entry: its label, or its id when it has none. */
export const entryName = (entry: { id: number | string; label: string }): string => entry.label || `#${entry.id}`;

const expandable = ({ step }: StepRow): boolean => step.entries.length > 0;

/** `… N more` for what a record cut from a list it kept `kept` of, or nothing when it cut none. */
const more = (total: number, kept: number, noun = ''): string | null =>
  total > kept ? `… ${total - kept} more${noun && ` ${noun}`}` : null;

function entriesText(step: DevtoolsHistoryRecord): string {
  const names = step.entries.map(entryName);
  const cut = more(step.entryCount, step.entries.length);
  return [...names, ...(cut ? [cut] : [])].join(', ') || '—';
}

function StepDetail({ step }: { step: DevtoolsHistoryRecord }): ReactElement {
  return (
    <div className={s.entries}>
      {step.entries.map((entry) => (
        <section key={entry.id} className={s.entry} aria-label={`Entry ${entryName(entry)}`}>
          <h4 className={s.entryTitle}>
            {entry.label || <span className={s.note}>{entryName(entry)}</span>}
            <span className={s.figure}>{entry.opCount} {entry.opCount === 1 ? 'op' : 'ops'}</span>
          </h4>
          <ul className={s.ops}>
            {entry.ops.map((op, i) => (
              <li key={i} className={s.op}>
                <Code size="sm">{op.kind}</Code>
                {op.targets.length > 0 && <span className={s.targets}>{op.targets.join(', ')}</span>}
                <ValueView value={op.summary} label={`${op.kind} arguments`} />
              </li>
            ))}
            {entry.opCount > entry.ops.length && <li className={s.note}>{more(entry.opCount, entry.ops.length, 'ops')}</li>}
          </ul>
        </section>
      ))}
      {step.entryCount > step.entries.length && <p className={s.note}>{more(step.entryCount, step.entries.length, 'entries')}</p>}
    </div>
  );
}

export function HistoryTable({ steps, now }: { steps: readonly Sequenced<DevtoolsHistoryRecord>[]; now: number }): ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const rows: StepRow[] = steps.slice(-DISPLAY_LIMIT).map(({ seq, record }) => ({ id: String(seq), step: record })).reverse();
  const columns: readonly DataGridColumn<StepRow>[] = [
    { id: 'age', header: 'Age', sortable: false, className: s.age, render: ({ step }) => formatAge(Math.max(0, now - step.ts)) },
    { id: 'step', header: 'Step', sortable: false, render: ({ step }) => step.step },
    {
      id: 'entries',
      header: 'Entries',
      sortable: false,
      render: ({ step }) => entriesText(step),
    },
    { id: 'ops', header: 'Ops', sortable: false, className: s.figure, render: ({ step }) => step.opCount },
    {
      id: 'position',
      header: 'Position',
      sortable: false,
      className: s.figure,
      render: ({ step }) => `${step.position.index} / ${step.position.total}`,
    },
  ];
  return (
    <DataGrid
      className={s.table}
      rows={rows}
      columns={columns}
      empty="No history steps yet. Edit the scene to fill the log."
      rowExpandable={expandable}
      expandedIds={expanded}
      onExpandedChange={setExpanded}
      onRowClick={(row) => {
        if (expandable(row)) setExpanded((cur) => (cur.has(row.id) ? new Set() : new Set([row.id])));
      }}
      renderDetail={({ step }) => <StepDetail step={step} />}
    />
  );
}
