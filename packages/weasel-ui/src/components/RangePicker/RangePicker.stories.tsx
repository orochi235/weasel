import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RangePicker, type Thumb } from './RangePicker';
import { paintGradientTrack } from '../../paintGradientTrack';
import { oklchToHex } from '../../color/oklch';

const meta: Meta<typeof RangePicker> = {
  title: 'weasel-ui/RangePicker',
  component: RangePicker,
};

export default meta;
type Story = StoryObj<typeof RangePicker>;

function Wrapper({ initial, ...rest }: { initial: Thumb[] } & Omit<Parameters<typeof RangePicker>[0], 'thumbs' | 'onChange'>) {
  const [thumbs, setThumbs] = useState<Thumb[]>(initial);
  return <RangePicker {...rest} thumbs={thumbs} onChange={setThumbs} />;
}

export const Single: Story = {
  render: () => <Wrapper initial={[{ value: 0.4 }]} min={0} max={1} step={0.01} />,
};

export const Pair: Story = {
  render: () => (
    <Wrapper
      initial={[{ value: 0.25 }, { value: 0.75 }]}
      min={0}
      max={1}
      step={0.01}
      constraint="ordered"
    />
  ),
};

export const ThreeStops: Story = {
  render: () => (
    <Wrapper
      initial={[
        { value: 0, label: 'A' },
        { value: 0.5, label: 'B' },
        { value: 1, label: 'C' },
      ]}
      min={0}
      max={1}
      step={0.01}
    />
  ),
};

export const HueGradientTrack: Story = {
  render: () => (
    <Wrapper
      initial={[{ value: 0.5, shape: 'notched' }]}
      min={0}
      max={1}
      step={0.001}
      trackHeight={20}
      renderTrack={paintGradientTrack({
        gradient: (t) => oklchToHex(0.7, 0.18, t * 360),
        samples: 24,
      })}
    />
  ),
};

function ActiveRangeHatchStory() {
  const [thumbs, setThumbs] = useState<Thumb[]>([
    { value: 0.3, shape: 'notched' },
    { value: 0.75, shape: 'notched' },
  ]);
  const activeRange: [number, number] = [thumbs[0].value, thumbs[1].value];
  return (
    <RangePicker
      thumbs={thumbs}
      onChange={setThumbs}
      min={0}
      max={1}
      step={0.001}
      constraint="ordered"
      trackHeight={20}
      renderTrack={paintGradientTrack({
        gradient: (t) => oklchToHex(0.7, 0.18, t * 360),
        samples: 24,
        activeRange,
      })}
    />
  );
}

export const ActiveRangeHatch: Story = {
  render: () => <ActiveRangeHatchStory />,
};

export const NotchedThumbs: Story = {
  render: () => (
    <Wrapper
      initial={[{ value: 0.2, shape: 'notched' }, { value: 0.8, shape: 'notched' }]}
      min={0}
      max={1}
      step={0.01}
    />
  ),
};
