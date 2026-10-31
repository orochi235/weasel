import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { Paint } from '@weasel-js/core';
import { meshFromStops, seedMeshPatch, type MeshGradientPaint } from '@weasel-js/core/mesh';
import { MeshHandles } from '@weasel-js/ui/components/MeshEditor';
import s from './MeshHandles.stories.module.css';

const meta: Meta<typeof MeshHandles> = {
  title: 'ui/MeshEditor/MeshHandles',
  component: MeshHandles,
};
export default meta;

type Story = StoryObj<typeof MeshHandles>;

const SIZE = 320;
const INSET = 40;
const SCALE = SIZE - INSET * 2;
const toScreen = (p: { x: number; y: number }) => ({ x: p.x * SCALE + INSET, y: p.y * SCALE + INSET });
const toLocal = (p: { x: number; y: number }) => ({ x: (p.x - INSET) / SCALE, y: (p.y - INSET) / SCALE });

function Live({ initial, ...args }: { initial: MeshGradientPaint; className?: string }) {
  const [value, setValue] = useState<Paint>(initial as unknown as Paint);
  return (
    <div className={s.stage}>
      <MeshHandles
        {...args}
        value={value as unknown as MeshGradientPaint}
        toScreen={toScreen}
        toLocal={toLocal}
        onInput={setValue}
        onChange={setValue}
        width={SIZE}
        height={SIZE}
      />
    </div>
  );
}

/** A unit-square patch mapped onto the stage: four corners and two controls per edge. A corner drags its controls with it. */
export const Default: Story = {
  render: (args) => <Live {...args} initial={seedMeshPatch('#3a7bd5ff')} />,
};

/** Two patches share a seam, so each of its points is one handle and a drag moves the seam rather than tearing it. */
export const SharedSeam: Story = {
  render: (args) => (
    <Live
      {...args}
      initial={meshFromStops([
        { offset: 0, color: '#000000ff' },
        { offset: 0.5, color: '#888888ff' },
        { offset: 1, color: '#ffffffff' },
      ])}
    />
  ),
};
