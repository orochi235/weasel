import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { createRecentColorsStore, RecentColorsProvider } from '@weasel-js/ui/components/RecentColors';
import { ColorField } from '@weasel-js/ui/components/ColorField';
import { SwatchStrip, BUILTIN_PALETTES, type SwatchPalette } from '@weasel-js/ui/components/SwatchStrip';

const meta: Meta<typeof SwatchStrip> = {
  title: 'Primitives/SwatchStrip',
  component: SwatchStrip,
};
export default meta;

type Story = StoryObj<typeof SwatchStrip>;

const BRAND: SwatchPalette = {
  id: 'brand',
  name: 'Brand',
  columns: 4,
  colors: [
    { value: '#1f2a44ff', label: 'Ink' },
    { value: '#3d5a80ff', label: 'Slate blue' },
    { value: '#98c1d9ff', label: 'Sky' },
    { value: '#e0fbfcff', label: 'Mist' },
    { value: '#ee6c4dff', label: 'Coral' },
    { value: '#293241ff', label: 'Night' },
  ],
};

function StripWithField({ args, palettes }: { args: Story['args']; palettes: readonly SwatchPalette[] }) {
  const [store] = useState(() => {
    const s = createRecentColorsStore({ storage: null });
    s.record(['#ee6c4dff', '#3d5a8080', '#98c1d9ff']);
    return s;
  });
  const [fill, setFill] = useState<string | null>('#ee6c4dff');
  return (
    <RecentColorsProvider store={store}>
      <ColorField value={fill ?? '#000000'} alpha onChange={setFill} aria-label="Fill" />
      <SwatchStrip {...args} value={fill} onChange={setFill} palettes={palettes} />
    </RecentColorsProvider>
  );
}

/** Applying a swatch, or committing a color in the field beside it, moves
 *  that color to the head of the recent row. The store is in memory here, so
 *  a reload starts empty. Six colors in four columns leave a short last row, which `align` places. */
export const Default: Story = {
  render: (args) => <StripWithField args={args} palettes={[BRAND]} />,
};

/** Every built-in palette, with the brand one after them. */
export const BuiltInPalettes: Story = {
  render: (args) => <StripWithField args={args} palettes={[...BUILTIN_PALETTES, BRAND]} />,
};
