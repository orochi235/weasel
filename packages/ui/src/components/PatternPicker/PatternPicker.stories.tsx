import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { PatternPaint } from '@weasel-js/core';
import { PatternPicker, seedPattern } from '@weasel-js/ui/components/PatternPicker';

const meta: Meta<typeof PatternPicker> = {
  title: 'ui/Foundations/PatternPicker',
  component: PatternPicker,
  args: { color: '#3a7bd5ff' },
};
export default meta;

type Story = StoryObj<typeof PatternPicker>;

type LiveArgs = Omit<Parameters<typeof PatternPicker>[0], 'value' | 'onChange'>;

function Live({ initial, ...args }: LiveArgs & { initial: PatternPaint }) {
  const [value, setValue] = useState<PatternPaint>(initial);
  return <PatternPicker {...args} value={value} onChange={setValue} />;
}

const COLOR = '#3a7bd5ff';

/** A tile swatch per kind, previewed in `color`, over the size switch and the rotation field. */
export const Default: Story = {
  render: (args) => <Live {...args} color={args.color ?? COLOR} initial={seedPattern('hatch', COLOR)} />,
};

/** Rotation edits only the rotation part of the transform; this one opens at 45°. */
export const Rotated: Story = {
  render: (args) => {
    const turn = Math.SQRT1_2;
    return <Live {...args} color={args.color ?? COLOR} initial={{ ...seedPattern('dots', COLOR, 16), transform: [turn, turn, -turn, turn] }} />;
  },
};
