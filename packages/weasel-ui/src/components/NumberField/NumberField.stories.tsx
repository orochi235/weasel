import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { NumberField } from './NumberField';

const meta: Meta<typeof NumberField> = {
  title: 'Primitives/NumberField',
  component: NumberField,
};
export default meta;

type Story = StoryObj<typeof NumberField>;

export const Basic: Story = { args: { label: 'Width', defaultValue: 120 } };
export const MinMaxStep: Story = { args: { label: 'Opacity', minValue: 0, maxValue: 100, step: 5, defaultValue: 80 } };
export const HideSteppers: Story = { args: { label: 'Count', hideSteppers: true, defaultValue: 1 } };
export const Disabled: Story = { args: { label: 'Locked', isDisabled: true, defaultValue: 50 } };

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState(10);
      return <NumberField label={`Q (= ${v})`} value={v} onChange={setV} />;
    }
    return <Wrap />;
  },
};
