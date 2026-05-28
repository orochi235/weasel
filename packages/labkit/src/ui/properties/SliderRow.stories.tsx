import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SliderRow } from './PropertyPanel';
import { SideBySide } from './storyLayouts';

const meta: Meta<typeof SliderRow> = {
  title: 'UI/Properties/Rows/SliderRow',
  component: SliderRow,
};
export default meta;
type Story = StoryObj<typeof SliderRow>;

function Controlled({
  initial,
  layout,
  ...rest
}: {
  initial: number;
  label: string;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  layout?: 'block' | 'inline';
}) {
  const [value, setValue] = useState(initial);
  return <SliderRow value={value} onChange={setValue} layout={layout} {...rest} />;
}

export const BothLayouts: Story = {
  render: () => (
    <SideBySide
      block={
        <Controlled
          initial={0.65}
          label="Opacity"
          min={0}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
        />
      }
      inline={
        <Controlled
          initial={0.65}
          label="Opacity"
          min={0}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
          layout="inline"
        />
      }
    />
  ),
};

export const WithUnit: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <Controlled initial={12} label="Radius" min={0} max={64} format={(v) => `${v}px`} />
    </div>
  ),
};
