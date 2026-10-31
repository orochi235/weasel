import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PlotData } from '@weasel-js/plot';
import { useState } from 'react';
import { PlotDataPanel } from '@weasel-js/ui/components/PlotDataPanel';

const meta: Meta<typeof PlotDataPanel> = {
  title: 'ui/Properties/PlotDataPanel',
  component: PlotDataPanel,
};
export default meta;
type Story = StoryObj<typeof PlotDataPanel>;

/** Holds the chart the panel edits, as a host would. */
function Authoring({ initial }: { initial: PlotData }) {
  const [data, setData] = useState(initial);
  return <PlotDataPanel data={data} onChange={(next) => setData(next)} />;
}

/** A pie from nothing: one table, rows added with the button below it. */
export const EmptyPie: Story = { render: () => <Authoring initial={{ kind: 'pie', slices: [] }} /> };

/** An xychart: a column per series in the data table, and the series in a table of their own. */
export const XyChart: Story = {
  render: () => (
    <Authoring initial={{
      kind: 'xychart', title: 'Sales', x: { kind: 'band', categories: ['Jan', 'Feb', 'Mar'] },
      series: [{ kind: 'bar', name: 'North', values: [4, 6, 3] }, { kind: 'line', name: 'South', values: [2, 5, 7] }],
    }}
    />
  ),
};

/** A gantt: open a section's row to edit the tasks it holds. */
export const Gantt: Story = {
  render: () => (
    <Authoring initial={{
      kind: 'gantt',
      sections: [{ name: 'Build', tasks: [
        { name: 'Design', id: 'd', start: { kind: 'date', date: '2024-01-01' }, end: { kind: 'duration', amount: 3, unit: 'd' } },
        { name: 'Code', start: { kind: 'after', ids: ['d'] }, end: { kind: 'duration', amount: 1, unit: 'w' }, tags: ['crit'] },
      ] }],
    }}
    />
  ),
};
