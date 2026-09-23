import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { DataGrid, type DataGridColumn } from './DataGrid';
import s from './DataGrid.stories.module.css';

const meta: Meta<typeof DataGrid> = {
  title: 'ui/Foundations/DataGrid',
  component: DataGrid,
};

export default meta;
type Story = StoryObj<typeof DataGrid>;

interface Route {
  id: string;
  action: string;
  scope: string;
  verdict: 'fires' | 'shadowed' | 'blocked';
  candidates: string[];
}

const ROUTES: Route[] = [
  { id: '1', action: 'move', scope: 'tool', verdict: 'fires', candidates: ['move', 'marquee'] },
  { id: '2', action: 'marquee', scope: 'tool', verdict: 'shadowed', candidates: ['marquee'] },
  { id: '3', action: 'resize', scope: 'chrome', verdict: 'blocked', candidates: [] },
  { id: '4', action: 'rotate', scope: 'chrome', verdict: 'fires', candidates: ['rotate', 'resize', 'move'] },
];

const COLUMNS: DataGridColumn<Route>[] = [
  { id: 'action', header: 'Action' },
  { id: 'scope', header: 'Scope' },
  { id: 'verdict', header: 'Verdict' },
  { id: 'cands', header: 'Cands', accessor: (r) => r.candidates.length },
];

const VERDICT_CLASS: Record<Route['verdict'], string | undefined> = {
  fires: s.fires,
  shadowed: s.shadowed,
  blocked: s.blocked,
};

export const Default: Story = {
  render: () => <DataGrid<Route> rows={ROUTES} columns={COLUMNS} />,
};

/** `rowClassName` tints each row by its verdict. */
export const RowClassName: Story = {
  render: () => <DataGrid<Route> rows={ROUTES} columns={COLUMNS} rowClassName={(r) => VERDICT_CLASS[r.verdict]} />,
};

/** `renderDetail` adds a disclosure column; sorting keeps each detail row under its parent. */
export const ExpandableDetail: Story = {
  render: () => (
    <DataGrid<Route>
      rows={ROUTES}
      columns={COLUMNS}
      defaultExpandedIds={['1']}
      rowExpandable={(r) => r.candidates.length > 0}
      renderDetail={(r) => (
        <ol className={s.detail}>
          {r.candidates.map((c) => <li key={c}><code>{c}</code></li>)}
        </ol>
      )}
    />
  ),
};

/** Controlled expansion driven by `onRowClick`: clicking (or Enter on) a row opens it and closes the rest. */
export const ClickToExpand: Story = {
  render: function ClickToExpand() {
    const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
    return (
      <DataGrid<Route>
        rows={ROUTES}
        columns={COLUMNS}
        expandedIds={open}
        onExpandedChange={setOpen}
        onRowClick={(r) => setOpen((cur) => (cur.has(r.id) ? new Set() : new Set([r.id])))}
        renderDetail={(r) => (r.candidates.length ? r.candidates.join(' → ') : 'No candidates considered.')}
      />
    );
  },
};
