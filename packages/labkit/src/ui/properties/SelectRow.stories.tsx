import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SelectRow } from './PropertyPanel';
import { SideBySide } from './storyLayouts';

const meta: Meta<typeof SelectRow> = {
  title: 'UI/Properties/Rows/SelectRow',
  component: SelectRow,
};
export default meta;
type Story = StoryObj<typeof SelectRow>;

const MODE_OPTIONS = [
  { value: 'fill', label: 'Fill only' },
  { value: 'stroke', label: 'Stroke only' },
  { value: 'both', label: 'Fill + stroke' },
] as const;

function Modes({ layout }: { layout?: 'block' | 'inline' }) {
  const [value, setValue] = useState<'fill' | 'stroke' | 'both'>('both');
  return (
    <SelectRow
      label="Render mode"
      value={value}
      onChange={setValue}
      options={MODE_OPTIONS}
      layout={layout}
    />
  );
}

export const BothLayouts: Story = {
  render: () => <SideBySide block={<Modes />} inline={<Modes layout="inline" />} />,
};

function ManyOptions() {
  const [value, setValue] = useState('round');
  return (
    <SelectRow
      label="Line cap"
      value={value}
      onChange={setValue}
      options={[
        { value: 'butt', label: 'Butt' },
        { value: 'round', label: 'Round' },
        { value: 'square', label: 'Square' },
      ]}
    />
  );
}

export const LineCap: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <ManyOptions />
    </div>
  ),
};
