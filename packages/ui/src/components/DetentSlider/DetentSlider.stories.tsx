import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DetentSlider, type DetentSliderProps, type DetentValue } from './DetentSlider';

const meta: Meta<typeof DetentSlider> = {
  title: 'Primitives/DetentSlider',
  component: DetentSlider,
  args: {
    labels: 'all',
    trackHeight: 8,
  },
  argTypes: {
    labels: { control: 'inline-radio', options: ['all', 'ends', 'none'] },
    trackHeight: { control: { type: 'range', min: 2, max: 24, step: 1 } },
    items: { table: { disable: true } },
    value: { table: { disable: true } },
    onChange: { table: { disable: true } },
    onCommit: { table: { disable: true } },
    formatLabel: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof DetentSlider>;

function Wrapper<V extends DetentValue>({
  initial,
  width = 260,
  ...rest
}: { initial: V; width?: number } & Omit<DetentSliderProps<V>, 'value' | 'onChange'>) {
  const [value, setValue] = useState<V>(initial);
  return (
    <div style={{ width }}>
      <DetentSlider {...rest} value={value} onChange={setValue} />
      <p style={{ margin: '12px 0 0', fontSize: 11, fontFamily: 'var(--wzl-font-mono)', color: 'var(--wzl-fg-muted)' }}>
        value: {String(value)}
      </p>
    </div>
  );
}

/**
 * The case this exists for: playback rate. The values are geometric, so a
 * linear value track would crowd four of the five detents into its first
 * fifth. Addressing the index instead spaces them evenly and puts 1× in the
 * middle, where it is easiest to hit.
 */
export const PlaybackRate: Story = {
  render: (args) => (
    <Wrapper
      {...args}
      items={[0.25, 0.5, 1, 2, 4]}
      initial={1}
      formatLabel={(r) => `${r}×`}
      ariaLabel="Playback rate"
    />
  ),
};

/** With enough detents to crowd the labels, `labels: 'ends'` keeps the extent
 *  legible and leaves the rest to the marks. */
export const ManyDetents: Story = {
  args: { labels: 'ends' },
  render: (args) => (
    <Wrapper
      {...args}
      width={320}
      items={[1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]}
      initial={8}
      formatLabel={(n) => `${n}px`}
      ariaLabel="Stroke width"
    />
  ),
};

/** Nothing about the control is numeric — the values are ordered, and that is
 *  all the line needs. */
export const OrdinalValues: Story = {
  render: (args) => (
    <Wrapper
      {...args}
      items={[
        { value: 'off', label: 'Off' },
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High', ariaLabel: 'High quality' },
      ]}
      initial={'low' as const}
      ariaLabel="Quality"
    />
  ),
};

/** Two detents is a toggle laid along a line. */
export const TwoDetents: Story = {
  render: (args) => (
    <Wrapper {...args} width={160} items={[0.5, 1]} initial={1} formatLabel={(r) => `${r}×`} ariaLabel="Rate" />
  ),
};
