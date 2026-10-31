import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { GradientPaint } from '@weasel-js/core';
import { GradientHandles } from '@weasel-js/ui/components/GradientEditor';
import s from './GradientHandles.stories.module.css';

const meta: Meta<typeof GradientHandles> = {
  title: 'ui/GradientEditor/GradientHandles',
  component: GradientHandles,
};
export default meta;

type Story = StoryObj<typeof GradientHandles>;

const WIDTH = 320;
const HEIGHT = 240;
const same = (p: { x: number; y: number }) => p;

const STOPS: GradientPaint['stops'] = [
  { offset: 0, color: '#ff3b30ff' },
  { offset: 1, color: '#007affff' },
];

function Live({ initial, className }: { initial: GradientPaint; className?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className={s.stage}>
      <GradientHandles
        className={className}
        value={value}
        toScreen={same}
        toLocal={same}
        onInput={setValue}
        onChange={setValue}
        width={WIDTH}
        height={HEIGHT}
      />
    </div>
  );
}

/** A linear gradient: a handle at each end of the ramp. */
export const Default: Story = {
  render: (args) => (
    <Live
      className={args.className}
      initial={{ kind: 'linear-gradient', from: { x: 60, y: 120 }, to: { x: 260, y: 120 }, stops: STOPS, units: 'local' } as GradientPaint}
    />
  ),
};

/** A radial gradient: the center, and a radius handle on its +x axis. */
export const Radial: Story = {
  render: (args) => (
    <Live
      className={args.className}
      initial={{ kind: 'radial-gradient', center: { x: 160, y: 120 }, radius: 80, stops: STOPS, units: 'local' } as GradientPaint}
    />
  ),
};
