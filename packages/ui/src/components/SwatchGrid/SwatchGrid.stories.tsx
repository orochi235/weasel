import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SwatchGrid, type SwatchGridOption } from '@weasel-js/ui/components/SwatchGrid';

const meta: Meta<typeof SwatchGrid> = {
  title: 'ui/SwatchGrid',
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
  args: { options: PALETTE, columns: 8, 'aria-label': 'Palette' },
  render: (args) => {
    const [fill, setFill] = useState<string | null>('#4a6fd4ff');
    const [stroke, setStroke] = useState<string | null>('#1a1a1aff');
    return (
      <div>
        <SwatchGrid
          {...args}
          options={args.options ?? PALETTE}
          value={fill}
          onSelect={setFill}
          onAltSelect={setStroke}
        />
        <p>fill {fill ?? 'none'} · stroke {stroke ?? 'none'}</p>
      </div>
    );
  },
};

const TAPES: SwatchGridOption[] = [
  { id: 'none', value: null, label: 'No tape' },
  { id: 'white', value: '#f4f4f0ff', label: 'White, black text', glyph: 'A', ink: '#000000ff' },
  { id: 'yellow', value: '#f2c230ff', label: 'Yellow, black text', glyph: 'A', ink: '#000000ff' },
  { id: 'cerulean-white', value: '#2a7ab0ff', label: 'Cerulean, white text', glyph: 'A', ink: '#ffffffff' },
  { id: 'cerulean-black', value: '#2a7ab0ff', label: 'Cerulean, black text', glyph: 'A', ink: '#000000ff' },
  { id: 'black', value: '#1a1a1aff', label: 'Black, white text', glyph: 'A', ink: '#ffffffff' },
];

/** Swatches keyed by `id` rather than color, each drawing a glyph in its own
 *  ink: the two cerulean tapes share a color and differ only in their text. */
export const Glyphs: Story = {
  args: { options: TAPES, columns: 6, 'aria-label': 'Tapes' },
  render: (args) => {
    const [tape, setTape] = useState<string | null>('cerulean-black');
    return (
      <div>
        <SwatchGrid {...args} options={args.options ?? TAPES} value={tape} onSelect={setTape} />
        <p>tape {tape ?? 'none'}</p>
      </div>
    );
  },
};

const PINS = 3;

/** A list of ids as `value` makes every swatch a toggle. With three pinned, the rest are disabled for a reason,
 *  which their tooltips give; a pinned one still unpins. */
export const Pinned: Story = {
  args: { options: PALETTE.slice(1, 13), columns: 6, 'aria-label': 'Pinned colors' },
  render: (args) => {
    const [pinned, setPinned] = useState<readonly string[]>(['#c64a3aff', '#3aa0c6ff']);
    const [hovered, setHovered] = useState<SwatchGridOption | null>(null);
    const full = pinned.length >= PINS;
    const options = (args.options ?? PALETTE).map((o) => {
      const off = full && o.value !== null && !pinned.includes(o.value);
      return off ? { ...o, disabled: true, disabledReason: `Only ${PINS} colors can be pinned` } : o;
    });
    return (
      <div>
        <SwatchGrid
          {...args}
          options={options}
          value={pinned}
          onSelect={(id) => {
            if (id === null) return;
            setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
          }}
          onHoverChange={setHovered}
        />
        <p>pinned {pinned.join(', ') || 'none'} · {hovered?.value ?? 'nothing hovered'}</p>
      </div>
    );
  },
};
