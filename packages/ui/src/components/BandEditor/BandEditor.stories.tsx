import { useState, type ComponentType } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { fraction, type DecimalDisplay, type FractionDisplay, type PercentDisplay } from '@weasel-js/quantity';
import { BandEditor } from '@weasel-js/ui/components/BandEditor';
import type { Band, BandEditorProps } from '@weasel-js/ui/components/BandEditor';

/** Stand-in for the first consumer's payload: the layout a wedge uses. */
type Slice = { name: string };

const MIN = 1 / 64;
const MAX = 1 / 2;

const TICKS = [1 / 45, 1 / 30, 1 / 24, 1 / 18, 1 / 12, 1 / 6, 1 / 3].map((at) => ({ at }));

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

/** `Display` is open to any kind, so the displays a story offers are named for forge to build their controls from. */
type Props = Omit<BandEditorProps<Slice>, 'display'> & { display?: FractionDisplay | DecimalDisplay | PercentDisplay };

const TypedBandEditor: ComponentType<Props> = BandEditor<Slice>;

const meta: Meta<typeof TypedBandEditor> = {
  title: 'ui/Foundations/BandEditor',
  component: TypedBandEditor,
  args: {
    min: MIN,
    max: MAX,
    scale: 'log',
    snap: true,
    ticks: TICKS,
    display: fraction(),
  },
  argTypes: {
    scale: { control: 'inline-radio' },
    value: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof TypedBandEditor>;

/** State a control seeds, set again whenever the control changes. */
function useSeeded<V>(arg: V): [V, (next: V) => void] {
  const [seed, setSeed] = useState(arg);
  const [state, setState] = useState(arg);
  if (!Object.is(seed, arg)) {
    setSeed(arg);
    setState(arg);
  }
  return [state, setState];
}

type WrapperProps = Omit<Props, 'value' | 'onChange'> & { initial: Band<Slice>[] };

function Wrapper({ initial, selectedIndex, ...rest }: WrapperProps) {
  const [value, setValue] = useState<Band<Slice>[]>(initial);
  const [selected, setSelected] = useSeeded(selectedIndex ?? null);
  return (
    <BandEditor<Slice>
      renderBand={(band) => band.data.name}
      {...rest}
      value={value}
      onChange={setValue}
      selectedIndex={selected}
      onSelect={setSelected}
    />
  );
}

export const DragASeam: Story = {
  args: { label: 'Drag the seam between the two bands to resize both.' },
  render: (args) => <Wrapper {...args} initial={LADDER} />,
};

export const DragABandBody: Story = {
  args: {
    label:
      'Drag an interior band body — both its seams move and the span is preserved. The first and last bands are pinned to min and max.',
  },
  render: (args) => <Wrapper {...args} initial={FOUR} />,
};

export const ClickTheRulerToSplit: Story = {
  args: { label: 'Click the tick ruler to split the band underneath.' },
  render: (args) => <Wrapper {...args} initial={LADDER} />,
};

export const ClickABandToSelect: Story = {
  args: { label: 'Click a band to select it; the selection is published.' },
  render: (args) => <Wrapper {...args} initial={FOUR} />,
};

export const MergeWithDeleteOrX: Story = {
  args: {
    label:
      'Select a band, then press x or Delete to merge it into its left neighbor, which keeps its payload. The first band cannot be merged away.',
  },
  render: (args) => <Wrapper {...args} initial={FOUR} />,
};

export const StepASeamWithArrows: Story = {
  args: { label: 'Tab to a seam and press ← or → to step it; shift for ten steps.' },
  render: (args) => <Wrapper {...args} initial={FOUR} />,
};

export const LinearScale: Story = {
  args: {
    scale: 'linear',
    label:
      'The same ladder on a linear scale — the narrow stops pile into the left of the track, which is why log is the default.',
  },
  render: (args) => <Wrapper {...args} initial={FOUR} />,
};

export const SplitMintsAPayload: Story = {
  args: { label: 'splitBand names the new band instead of duplicating the one it came from. Click the ruler.' },
  render: (args) => <Wrapper {...args} initial={LADDER} splitBand={(_at, from) => ({ name: `${from.name} (narrow)` })} />,
};

function RangeWrapper({ initial, selectedIndex, min, max, ...rest }: WrapperProps) {
  const [value, setValue] = useState<Band<Slice>[]>(initial);
  const [from, setFrom] = useSeeded(min);
  const [to, setTo] = useSeeded(max);
  const [selected, setSelected] = useSeeded(selectedIndex ?? null);
  return (
    <BandEditor<Slice>
      renderBand={(band) => band.data.name}
      {...rest}
      value={value}
      min={from}
      max={to}
      onChange={setValue}
      onRangeChange={(min, max, bands) => {
        setFrom(min);
        setTo(max);
        setValue(bands);
      }}
      selectedIndex={selected}
      onSelect={setSelected}
    />
  );
}

export const RescaleTheRange: Story = {
  args: {
    limits: [1 / 256, 1],
    label:
      'Drag either end of the strip to rescale the whole sequence; pull past the track and the axis squeezes to fit. Right-click a band, or select it and press l, to lock it: a locked band is hatched and holds its length while the rest stretch.',
  },
  render: (args) => <RangeWrapper {...args} initial={[FOUR[0], FOUR[1], { ...FOUR[2], locked: true }, FOUR[3]]} />,
};
