import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { CheckboxRow, SwitchRow } from './PropertyPanel';

const meta: Meta<typeof SwitchRow> = {
  title: 'ui/Properties/Rows/SwitchRow',
  component: SwitchRow,
};
export default meta;
type Story = StoryObj<typeof SwitchRow>;

function Controlled({ initial, label }: { initial: boolean; label: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ width: 280 }}>
      <SwitchRow label={label} value={value} onChange={setValue} />
    </div>
  );
}

export const Default: Story = {
  render: () => <Controlled initial={true} label="Snap to grid" />,
};

export const Off: Story = {
  render: () => <Controlled initial={false} label="Show rulers" />,
};

/** The two boolean rows side by side — they share a row layout on purpose. */
export const BesideACheckbox: Story = {
  render: function BesideACheckboxStory() {
    const [checked, setChecked] = useState(true);
    const [on, setOn] = useState(true);
    return (
      <div style={{ width: 280 }}>
        <CheckboxRow label="Visible" value={checked} onChange={setChecked} />
        <SwitchRow label="Snap to grid" value={on} onChange={setOn} />
      </div>
    );
  },
};
