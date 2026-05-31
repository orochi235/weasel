import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { RangeSlider } from './RangeSlider';

const meta: Meta<typeof RangeSlider> = {
  title: 'Primitives/RangeSlider',
  component: RangeSlider,
};
export default meta;

type Story = StoryObj<typeof RangeSlider>;

export const Basic: Story = { args: { label: 'Opacity', defaultValue: 40, minValue: 0, maxValue: 100 } };

export const WithFormatting: Story = {
  args: {
    label: 'Opacity',
    defaultValue: 75,
    minValue: 0,
    maxValue: 100,
    formatOutput: (v) => `${v}%`,
  },
};

export const MultiThumb: Story = {
  args: { label: 'Range', defaultValue: [20, 80], minValue: 0, maxValue: 100 },
};

export const Vertical: Story = {
  args: { label: 'Volume', defaultValue: 60, minValue: 0, maxValue: 100, orientation: 'vertical' },
};

export const Disabled: Story = {
  args: { label: 'Locked', defaultValue: 30, minValue: 0, maxValue: 100, isDisabled: true },
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState(50);
      return (
        <RangeSlider
          label="Q"
          value={v}
          onChange={setV as (v: number | number[]) => void}
          minValue={0}
          maxValue={100}
        />
      );
    }
    return <Wrap />;
  },
};
