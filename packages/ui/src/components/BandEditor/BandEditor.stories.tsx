import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BandEditor } from './BandEditor';
import type { Band } from './bands';

/** Stand-in for the first consumer's payload: the layout a wedge uses. */
type Slice = { name: string };

const MIN = 1 / 64;
const MAX = 1 / 2;

const TICKS = [1 / 45, 1 / 30, 1 / 24, 1 / 18, 1 / 12, 1 / 6, 1 / 3].map((at) => ({
  at,
  label: `1/${Math.round(1 / at)}`,
}));

const LADDER: Band<Slice>[] = [
  { from: MIN, data: { name: 'Radial' } },
  { from: 1 / 12, data: { name: 'Name plate' } },
];

const FOUR: Band<Slice>[] = [
  { from: MIN, data: { name: 'Icon' } },
  { from: 1 / 24, data: { name: 'Radial' } },
  { from: 1 / 12, data: { name: 'Name plate' } },
  { from: 1 / 4, data: { name: 'Full' } },
];

const TypedBandEditor = BandEditor<Slice>;

const meta: Meta<typeof TypedBandEditor> = {
  title: 'weasel-ui/Foundations/BandEditor',
  component: TypedBandEditor,
  args: {
    min: MIN,
    max: MAX,
    scale: 'log',
    snap: true,
    ticks: TICKS,
  },
  argTypes: {
    scale: { control: 'inline-radio', options: ['linear', 'log'] },
    snap: { control: 'boolean' },
    min: { control: { type: 'number' } },
    max: { control: { type: 'number' } },
    value: { table: { disable: true } },
    ticks: { table: { disable: true } },
    onInput: { table: { disable: true } },
    onChange: { table: { disable: true } },
    onSelect: { table: { disable: true } },
    selectedIndex: { table: { disable: true } },
    renderBand: { table: { disable: true } },
    splitBand: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof TypedBandEditor>;

type WrapperProps = Omit<
  Parameters<typeof TypedBandEditor>[0],
  'value' | 'onChange' | 'selectedIndex' | 'onSelect'
> & { initial: Band<Slice>[]; hint: ReactNode };

function Wrapper({ initial, hint, ...rest }: WrapperProps) {
  const [value, setValue] = useState<Band<Slice>[]>(initial);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <BandEditor<Slice>
      {...rest}
      label={hint}
      value={value}
      onChange={setValue}
      selectedIndex={selected}
      onSelect={setSelected}
      renderBand={(band) => band.data.name}
    />
  );
}

export const DragASeam: Story = {
  render: (args) => (
    <Wrapper {...args} initial={LADDER} hint="Drag the seam between the two bands to resize both." />
  ),
};

export const DragABandBody: Story = {
  render: (args) => (
    <Wrapper
      {...args}
      initial={FOUR}
      hint="Drag an interior band body — both its seams move and the span is preserved. The first and last bands are pinned to min and max."
    />
  ),
};

export const ClickTheRulerToSplit: Story = {
  render: (args) => (
    <Wrapper {...args} initial={LADDER} hint="Click the tick ruler to split the band underneath." />
  ),
};

export const ClickABandToSelect: Story = {
  render: (args) => (
    <Wrapper {...args} initial={FOUR} hint="Click a band to select it; the selection is published." />
  ),
};

export const MergeWithDeleteOrX: Story = {
  render: (args) => (
    <Wrapper
      {...args}
      initial={FOUR}
      hint="Select a band, then press x or Delete to merge it into its left neighbour, which keeps its payload. The first band cannot be merged away."
    />
  ),
};

export const StepASeamWithArrows: Story = {
  render: (args) => (
    <Wrapper
      {...args}
      initial={FOUR}
      hint="Tab to a seam and press ← or → to step it; shift for ten steps."
    />
  ),
};

export const LinearScale: Story = {
  args: { scale: 'linear' },
  render: (args) => (
    <Wrapper
      {...args}
      initial={FOUR}
      hint="The same ladder on a linear scale — the narrow stops pile into the left of the track, which is why log is the default."
    />
  ),
};

export const SplitMintsAPayload: Story = {
  render: (args) => (
    <Wrapper
      {...args}
      initial={LADDER}
      hint="splitBand names the new band instead of duplicating the one it came from. Click the ruler."
      splitBand={(_at, from) => ({ name: `${from.name} (narrow)` })}
    />
  ),
};
