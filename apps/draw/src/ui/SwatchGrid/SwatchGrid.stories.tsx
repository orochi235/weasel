import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SwatchGrid } from './SwatchGrid';

const meta: Meta<typeof SwatchGrid> = {
  title: 'ui/SwatchGrid',
  component: SwatchGrid,
};

export default meta;
type Story = StoryObj<typeof SwatchGrid>;

const PALETTE = [
  '#1a1a1a', '#c64a3a', '#d4843a', '#d4c43a',
  '#5ab04a', '#3aa0c6', '#4a6fd4', '#9a4ad4',
  '#d44a9a', '#6a6a6a', '#a4a4a4', '#ffffff',
];

export const Default: Story = {
  render: () => {
    const [color, setColor] = useState<string | null>(PALETTE[6]);
    return (
      <SwatchGrid
        value={color}
        onChange={setColor}
        options={[{ value: null, label: 'None' }, ...PALETTE.map((c) => ({ value: c }))]}
        columns={6}
      />
    );
  },
};
