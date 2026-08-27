import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { InlineRange } from './InlineRange';

const meta: Meta<typeof InlineRange> = {
  title: 'Primitives/InlineRange',
  component: InlineRange,
};
export default meta;

type Story = StoryObj<typeof InlineRange>;

function Row({ label, min, max, start }: { label: string; min: number; max: number; start: number }) {
  const [v, setV] = useState(start);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 260 }}>
      <span style={{ width: 60, opacity: 0.75 }}>{label}</span>
      <InlineRange
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
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Row label="Width" min={0} max={20} start={6} />
      <Row label="Opacity" min={0} max={100} start={100} />
    </div>
  ),
};

/** The filled portion is painted, not left to `accent-color` — the unfilled
 *  remainder is a theme token at every value, including zero. */
export const AcrossItsRange: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 260 }}>
      {[0, 25, 50, 75, 100].map((v) => (
        <InlineRange key={v} aria-label={`${v} percent`} min={0} max={100} value={v} readOnly />
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  render: () => <InlineRange aria-label="Disabled" min={0} max={100} value={40} disabled readOnly />,
};
