import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SwatchGrid, type SwatchGridOption } from './SwatchGrid';

const meta: Meta<typeof SwatchGrid> = {
  title: 'Primitives/SwatchGrid',
  component: SwatchGrid,
};
export default meta;

type Story = StoryObj<typeof SwatchGrid>;

const PALETTE: SwatchGridOption[] = [
  { value: null, label: 'None' },
  ...[
    '#1a1a1aff', '#c64a3aff', '#d4843aff', '#d4c43aff', '#5ab04aff', '#3aa0c6ff',
    '#4a6fd4ff', '#9a4ad4ff', '#d44a9aff', '#6a6a6aff', '#a4a4a4ff', '#ffffffff',
    '#c64a3a80', '#3aa0c680', '#4a6fd440', '#00000000', '#ffffff80',
  ].map((value) => ({ value })),
];

/** Click applies to the first target; shift-click, right-click or
 *  Shift+Enter to the second. */
export const Default: Story = {
  render: () => {
    const [fill, setFill] = useState<string | null>('#4a6fd4ff');
    const [stroke, setStroke] = useState<string | null>('#1a1a1aff');
    return (
      <div>
        <SwatchGrid
          options={PALETTE}
          value={fill}
          onChange={setFill}
          onAltChange={setStroke}
          columns={6}
          aria-label="Palette"
        />
        <p>fill {fill ?? 'none'} · stroke {stroke ?? 'none'}</p>
      </div>
    );
  },
};
