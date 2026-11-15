import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Field } from '@weasel-js/ui/components/Field';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import s from './InlineRange.stories.module.css';

const meta: Meta<typeof InlineRange> = {
  title: 'ui/InlineRange',
  component: InlineRange,
};
export default meta;

type Story = StoryObj<typeof InlineRange>;

function Row({ args, label, min, max, start }: { args: Story['args']; label: string; min: number; max: number; start: number }) {
  const [v, setV] = useState(start);
  return (
    <Field orientation="row" label={label} output={v}>
      <InlineRange
        {...args}
        aria-label={label}
        min={min}
        max={max}
        value={v}
        onChange={(e) => setV(Number((e.target as HTMLInputElement).value))}
      />
    </Field>
  );
}

/** The two property-row uses, each a row `Field` with its readout: a bounded quantity and a percentage. */
export const InAPropertyRow: Story = {
  render: (args) => (
    <div className={s.stack}>
      <Row args={args} label="Width" min={0} max={20} start={6} />
      <Row args={args} label="Opacity" min={0} max={100} start={100} />
    </div>
  ),
};

/** The filled portion is painted, not left to `accent-color` — the unfilled
 *  remainder is a theme token at every value, including zero. */
export const AcrossItsRange: Story = {
  render: (args) => (
    <div className={s.stack}>
      {[0, 25, 50, 75, 100].map((v) => (
        <InlineRange {...args} key={v} aria-label={`${v} percent`} min={0} max={100} value={v} readOnly />
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: { 'aria-label': 'Disabled', min: 0, max: 100, value: 40, disabled: true, readOnly: true },
};
