import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { UnitField } from '@weasel-js/ui/components/NumberField';

const meta: Meta<typeof UnitField> = {
  title: 'ui/Foundations/NumberField/UnitField',
  component: UnitField,
  args: { steppers: true, disabled: false, mixed: false },
};
export default meta;

type Story = StoryObj<typeof UnitField>;

/** A plain number with steppers. Arrow keys step by one, Page Up and Page Down by ten. */
export const Default: Story = {
  render: (args) => {
    const [v, setV] = useState(12);
    return <UnitField aria-label="Size" {...args} value={v} onChange={setV} />;
  },
};

/** `accepts` lets a person type another unit: `5mm` here commits as 0.5 cm. Bounded to 0–100. */
export const AcceptsUnits: Story = {
  render: (args) => {
    const [v, setV] = useState(2.5);
    return (
      <UnitField
        aria-label="Length in cm"
        {...args}
        value={v}
        onChange={setV}
        accepts={{ mm: 0.1, cm: 1, in: 2.54 }}
        minValue={0}
        maxValue={100}
        step={0.5}
      />
    );
  },
};

/** Standing for several values that differ, it shows empty and reads Mixed. */
export const Mixed: Story = {
  args: { mixed: true, value: Number.NaN, onChange: () => {}, 'aria-label': 'Size' },
};
