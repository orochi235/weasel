import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { FillStyle } from '@weasel-js/core';
import { PaintField } from './PaintField';

const meta: Meta<typeof PaintField> = {
  title: 'Primitives/PaintField',
  component: PaintField,
};
export default meta;

type Story = StoryObj<typeof PaintField>;

const LINEAR: FillStyle = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 1 },
  stops: [
    { offset: 0, color: '#f2545bff' },
    { offset: 1, color: '#2d7dd2ff' },
  ],
  units: 'bounds',
  interpolate: 'oklch',
};

const CONIC: FillStyle = {
  fill: 'conic-gradient',
  center: { x: 0.5, y: 0.5 },
  angle: 0,
  stops: [
    { offset: 0, color: '#f2c14eff' },
    { offset: 0.5, color: '#3fb08cff' },
    { offset: 1, color: '#f2c14eff' },
  ],
  units: 'bounds',
};

/** A property row is the slot this control was shaped for: a fixed label
 *  column and a narrow control column. */
function Row({ label, initial }: { label: string; initial: FillStyle | null }) {
  const [paint, setPaint] = useState<FillStyle | null>(initial);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 260 }}>
      <span style={{ flex: '0 0 90px', fontSize: 12 }}>{label}</span>
      <span style={{ flex: '0 0 110px' }}>
        <PaintField value={paint} onChange={setPaint} aria-label={label} />
      </span>
    </label>
  );
}

export const InAPropertyRow: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8, padding: 16 }}>
      <Row label="Solid" initial={{ fill: 'solid', color: '#7a5af5ff' }} />
      <Row label="Linear (OKLCh)" initial={LINEAR} />
      <Row label="Conic" initial={CONIC} />
      <Row label="No paint" initial={null} />
    </div>
  ),
};

export const Mixed: Story = {
  args: { value: undefined, mixed: true, onChange: () => {}, 'aria-label': 'Fill' },
};
