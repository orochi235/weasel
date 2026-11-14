import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Slider, useDetents, type DetentItem, type DetentValue } from '@weasel-js/ui/components/Slider';
import st from './Slider.detents.stories.module.css';

type Args = { stopLabels: 'all' | 'ends' | 'none'; trackHeight: number };

const meta: Meta<Args> = {
  title: 'ui/Foundations/Slider',
  args: { stopLabels: 'all', trackHeight: 8 },
  argTypes: {
    stopLabels: { control: 'inline-radio', options: ['all', 'ends', 'none'] },
    trackHeight: { control: { type: 'range', min: 2, max: 24, step: 1 } },
  },
};
export default meta;
type Story = StoryObj<Args>;

function Detents<V extends DetentValue>({ args, items, initial, label, formatLabel, wide }: {
  args: Args;
  items: readonly (V | DetentItem<V>)[];
  initial: V;
  label: string;
  formatLabel?: (value: V) => string;
  wide?: boolean;
}) {
  const [value, setValue] = useState<V>(initial);
  const detents = useDetents({ items, value, onInput: setValue, formatLabel });
  return (
    <div className={wide ? st.wide : st.frame}>
      <Slider {...args} {...detents} aria-label={label} />
      <p className={st.value}>value: {String(value)}</p>
    </div>
  );
}

/**
 * The case detents exist for: playback rate. The values are geometric, so a
 * linear value track would crowd four of the five into its first fifth.
 * Addressing the index instead spaces them evenly and puts 1× in the middle.
 */
export const DetentsPlaybackRate: Story = {
  render: (args) => <Detents args={args} items={[0.25, 0.5, 1, 2, 4]} initial={1} formatLabel={(r) => `${r}×`} label="Playback rate" />,
};

/** With enough detents to crowd the labels, `stopLabels: 'ends'` keeps the extent legible. */
export const ManyDetents: Story = {
  args: { stopLabels: 'ends' },
  render: (args) => (
    <Detents args={args} wide items={[1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]} initial={8} formatLabel={(n) => `${n}px`} label="Stroke width" />
  ),
};

/** Nothing about the values is numeric; they are ordered, and that is all the line needs. */
export const OrdinalDetents: Story = {
  render: (args) => (
    <Detents
      args={args}
      items={[{ value: 'off', label: 'Off' }, { value: 'low', label: 'Low' }, { value: 'high', label: 'High', ariaLabel: 'High quality' }]}
      initial="low"
      label="Quality"
    />
  ),
};
