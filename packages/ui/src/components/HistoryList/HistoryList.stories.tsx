import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { HistoryList } from '@weasel-js/ui/components/HistoryList';

const ENTRIES = [
  { id: 'initial', label: 'Initial' },
  { id: '1', label: 'Draw rectangle' },
  { id: '2', label: 'Fill' },
  { id: '3', label: 'Move' },
  { id: '4', label: 'Rotate' },
];

const meta: Meta<typeof HistoryList> = {
  title: 'ui/HistoryList',
  component: HistoryList,
};
export default meta;

type Story = StoryObj<typeof HistoryList>;

/** Pick a row to jump there; the states after it dim as redoable. */
export const Default: Story = {
  args: { entries: ENTRIES, current: 2 },
  render: (args) => {
    const [current, setCurrent] = useState(args.current);
    return <HistoryList {...args} current={current} onJump={setCurrent} />;
  },
};

/** A long history scrolls inside its own box, keeping the current row in view. */
export const Long: Story = {
  args: {
    entries: [{ id: 'initial', label: 'Initial' }, ...Array.from({ length: 40 }, (_, i) => ({ id: String(i + 1), label: `Step ${i + 1}` }))],
    current: 35,
  },
  render: Default.render,
};

export const Empty: Story = { args: { entries: [], current: 0, empty: 'No history yet' }, render: Default.render };
