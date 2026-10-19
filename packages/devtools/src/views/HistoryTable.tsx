/** History steps as rows, newest first; a row opens to the entries it touched and each entry's ops. */
import { useState, type ReactElement } from 'react';
import type { DevtoolsHistoryRecord } from '@weasel-js/core/devtools-protocol';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { formatAge } from './formatAge';
import { ValueView } from './ValueView';
import s from './HistoryView.module.css';

const DISPLAY_LIMIT = 100;

interface StepRow { id: string; step: DevtoolsHistoryRecord }

const opCount = (step: DevtoolsHistoryRecord): number => step.entries.reduce((n, e) => n + e.opCount, 0);

function StepDetail({ step }: { step: DevtoolsHistoryRecord }): ReactElement {
  return (
    <div className={s.entries}>
      {step.entries.map((entry) => (
        <section key={entry.id} className={s.entry} aria-label={`Entry ${entry.label || entry.id}`}>
          <h4 className={s.entryTitle}>
            {entry.label || <span className={s.note}>unlabeled</span>}
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
          </ul>
        </section>
      ))}
    </div>
  );
}

export function HistoryTable({ steps, now }: { steps: readonly DevtoolsHistoryRecord[]; now: number }): ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const rows: StepRow[] = steps.map((step, i) => ({ id: `${step.ts}-${i}`, step })).slice(-DISPLAY_LIMIT).reverse();
  const columns: readonly DataGridColumn<StepRow>[] = [
    { id: 'age', header: 'Age', sortable: false, className: s.age, render: ({ step }) => formatAge(Math.max(0, now - step.ts)) },
    { id: 'step', header: 'Step', sortable: false, render: ({ step }) => step.step },
    {
      id: 'entries',
      header: 'Entries',
      sortable: false,
      render: ({ step }) => step.entries.map((e) => e.label || `#${e.id}`).join(', ') || '—',
    },
    { id: 'ops', header: 'Ops', sortable: false, className: s.figure, render: ({ step }) => opCount(step) },
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
      rowExpandable={({ step }) => step.entries.length > 0}
      expandedIds={expanded}
      onExpandedChange={setExpanded}
      onRowClick={({ id }) => setExpanded((cur) => (cur.has(id) ? new Set() : new Set([id])))}
      renderDetail={({ step }) => <StepDetail step={step} />}
    />
  );
}
