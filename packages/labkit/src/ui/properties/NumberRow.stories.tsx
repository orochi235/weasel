import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { NumberRow } from './PropertyPanel';
import { SideBySide } from './storyLayouts';

const meta: Meta<typeof NumberRow> = {
  title: 'UI/Properties/Rows/NumberRow',
  component: NumberRow,
};
export default meta;
type Story = StoryObj<typeof NumberRow>;

function Controlled({
  initial,
  label,
  min,
  max,
  step,
  layout,
}: {
  initial: number;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  layout?: 'block' | 'inline';
}) {
  const [value, setValue] = useState(initial);
  return (
    <NumberRow
      label={label}
      value={value}
      onChange={setValue}
      min={min}
      max={max}
      step={step}
      layout={layout}
    />
  );
}

export const BothLayouts: Story = {
  render: () => (
    <SideBySide
      block={<Controlled initial={8} label="Count" min={0} max={100} step={1} />}
      inline={<Controlled initial={8} label="Count" min={0} max={100} step={1} layout="inline" />}
    />
  ),
};

export const Float: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <Controlled initial={1.5} label="Factor" min={0} max={10} step={0.1} />
    </div>
  ),
};

export const Unbounded: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <Controlled initial={0} label="Offset" />
    </div>
  ),
};
