import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';

const meta: Meta<typeof InlineRange> = {
  title: 'ui/Foundations/InlineRange',
  component: InlineRange,
};
export default meta;

type Story = StoryObj<typeof InlineRange>;

function Row({ args, label, min, max, start }: { args: Story['args']; label: string; min: number; max: number; start: number }) {
  const [v, setV] = useState(start);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 260 }}>
      <span style={{ width: 60, opacity: 0.75 }}>{label}</span>
      <InlineRange
        {...args}
        aria-label={label}
        min={min}
        max={max}
        value={v}
        onChange={(e) => setV(Number((e.target as HTMLInputElement).value))}
      />
      <span style={{ width: '4ch', textAlign: 'end', opacity: 0.7 }}>{v}</span>
    </label>
  );
}

/** The two property-row uses: a bounded quantity and a percentage. */
export const InAPropertyRow: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Row args={args} label="Width" min={0} max={20} start={6} />
      <Row args={args} label="Opacity" min={0} max={100} start={100} />
    </div>
  ),
};

/** The filled portion is painted, not left to `accent-color` — the unfilled
 *  remainder is a theme token at every value, including zero. */
export const AcrossItsRange: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 260 }}>
      {[0, 25, 50, 75, 100].map((v) => (
        <InlineRange {...args} key={v} aria-label={`${v} percent`} min={0} max={100} value={v} readOnly />
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: { 'aria-label': 'Disabled', min: 0, max: 100, value: 40, disabled: true, readOnly: true },
};
