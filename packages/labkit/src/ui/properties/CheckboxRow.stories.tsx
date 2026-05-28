import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CheckboxRow } from './PropertyPanel';

const meta: Meta<typeof CheckboxRow> = {
  title: 'UI/Properties/Rows/CheckboxRow',
  component: CheckboxRow,
};
export default meta;
type Story = StoryObj<typeof CheckboxRow>;

function Controlled({ initial, label }: { initial: boolean; label: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ width: 280 }}>
      <CheckboxRow label={label} value={value} onChange={setValue} />
    </div>
  );
}

export const Default: Story = {
  render: () => <Controlled initial={true} label="Visible" />,
};

export const Unchecked: Story = {
  render: () => <Controlled initial={false} label="Snap to grid" />,
};
