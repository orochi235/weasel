import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { Paint } from '@weasel-js/core';
import { meshFromStops, seedMeshPatch, type MeshGradientPaint } from '@weasel-js/core/mesh';
import { MeshEditor } from '@weasel-js/ui/components/MeshEditor';

const meta: Meta<typeof MeshEditor> = {
  title: 'ui/MeshEditor',
  component: MeshEditor,
  args: { spaceSwitch: true },
};
export default meta;

type Story = StoryObj<typeof MeshEditor>;

function Live({ initial, ...args }: { initial: MeshGradientPaint; spaceSwitch?: boolean; className?: string }) {
  const [value, setValue] = useState<Paint>(initial as unknown as Paint);
  return <MeshEditor {...args} value={value as unknown as MeshGradientPaint} onInput={setValue} onChange={setValue} />;
}

/** One patch: a color field per corner, and the space the corners blend through. */
export const Default: Story = {
  render: (args) => <Live {...args} initial={seedMeshPatch('#3a7bd5ff')} />,
};

/** A mesh built from a three-stop ramp has a patch per gap, each with its own row and swatch. */
export const TwoPatches: Story = {
  render: (args) => (
    <Live
      {...args}
      initial={meshFromStops([
        { offset: 0, color: '#ff3b30ff' },
        { offset: 0.5, color: '#ffcc00ff' },
        { offset: 1, color: '#007affff' },
      ])}
    />
  ),
};
