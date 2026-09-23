import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { FillStyle } from '@weasel-js/core';
import type { PaintSlot } from '../GradientEditor';
import { FillStrokeSwatch } from './FillStrokeSwatch';

const meta: Meta<typeof FillStrokeSwatch> = {
  title: 'Primitives/FillStrokeSwatch',
  component: FillStrokeSwatch,
};
export default meta;

type Story = StoryObj<typeof FillStrokeSwatch>;

const solid = (color: string): FillStyle => ({ fill: 'solid', color });
const DEFAULTS = { fill: solid('#ffffffff'), stroke: solid('#000000ff') };

function Live({ initial }: { initial: { fill: FillStyle | null; stroke: FillStyle | null } }) {
  const [paints, setPaints] = useState(initial);
  const [focused, setFocused] = useState<PaintSlot>('fill');
  const set = (slot: PaintSlot, paint: FillStyle | null) =>
    setPaints((p) => ({ ...p, [slot]: paint }));
  return (
    <FillStrokeSwatch
      fill={paints.fill}
      stroke={paints.stroke}
      focused={focused}
      onFocusChange={setFocused}
      onInput={(slot, color) => set(slot, solid(color))}
      onChange={(slot, color) => set(slot, solid(color))}
      onToggleNone={(slot) => set(slot, paints[slot] === null ? DEFAULTS[slot] : null)}
      onSwap={() => setPaints((p) => ({ fill: p.stroke, stroke: p.fill }))}
      onReset={() => setPaints(DEFAULTS)}
      shortcuts={{ none: '/', swap: 'X', reset: 'D' }}
    />
  );
}

/** Click a chip for the picker, shift-click it for none. */
export const Default: Story = {
  render: () => <Live initial={{ fill: solid('#7ab8d4ff'), stroke: solid('#1a1a1aff') }} />,
};

/** No stroke, and a translucent fill over the checker. */
export const NoneAndTranslucent: Story = {
  render: () => <Live initial={{ fill: solid('#e0406080'), stroke: null }} />,
};

/** A gradient fill previews as its ramp. */
export const Gradient: Story = {
  render: () => (
    <Live
      initial={{
        fill: {
          fill: 'linear-gradient',
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
          stops: [
            { offset: 0, color: '#f2545bff' },
            { offset: 1, color: '#2d7dd2ff' },
          ],
          units: 'bounds',
        },
        stroke: solid('#1a1a1aff'),
      }}
    />
  ),
};
