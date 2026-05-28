import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ToggleRow } from './PropertyPanel';
import { SideBySide } from './storyLayouts';

const meta: Meta<typeof ToggleRow> = {
  title: 'UI/Properties/Rows/ToggleRow',
  component: ToggleRow,
};
export default meta;
type Story = StoryObj<typeof ToggleRow>;

const ALIGN_OPTIONS = [
  { value: 'left', label: 'L' },
  { value: 'center', label: 'C' },
  { value: 'right', label: 'R' },
] as const;

function Align({ layout }: { layout?: 'block' | 'inline' }) {
  const [value, setValue] = useState<'left' | 'center' | 'right'>('center');
  return (
    <ToggleRow
      label="Align"
      value={value}
      onChange={setValue}
      options={ALIGN_OPTIONS}
      layout={layout}
    />
  );
}

export const BothLayouts: Story = {
  render: () => <SideBySide block={<Align />} inline={<Align layout="inline" />} />,
};

function TwoOptions() {
  const [value, setValue] = useState<'on' | 'off'>('on');
  return (
    <ToggleRow
      label="Snapping"
      value={value}
      onChange={setValue}
      options={[
        { value: 'on', label: 'On' },
        { value: 'off', label: 'Off' },
      ]}
    />
  );
}

export const TwoOption: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <TwoOptions />
    </div>
  ),
};
