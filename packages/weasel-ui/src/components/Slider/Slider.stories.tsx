import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { Slider, type Thumb } from './Slider';
import { paintGradientTrack } from '../../paintGradientTrack';
import { oklchToHex } from '../../color/oklch';

const meta: Meta<typeof Slider> = {
  title: 'weasel-ui/Foundations/Slider',
  component: Slider,
  args: {
    min: 0,
    max: 1,
    step: 0.01,
    constraint: 'free',
    trackHeight: 8,
    readoutPlacement: 'inline-after',
    allowShiftAll: false,
    ariaLabel: 'slider',
    // Custom (non-Slider) arg consumed by the Playground story.
    thumbCount: 3,
  } as never,
  argTypes: {
    min: { control: { type: 'number' } },
    max: { control: { type: 'number' } },
    step: { control: { type: 'range', min: 0.001, max: 0.5, step: 0.001 } },
    constraint: { control: 'inline-radio', options: ['free', 'ordered'] },
    trackHeight: { control: { type: 'range', min: 2, max: 40, step: 1 } },
    readoutPlacement: {
      control: 'inline-radio',
      options: ['none', 'inline-after', 'below-thumb'],
    },
    allowShiftAll: { control: 'boolean' },
    ariaLabel: { control: 'text' },
    thumbs: { table: { disable: true } },
    onChange: { table: { disable: true } },
    onCommit: { table: { disable: true } },
    onAddThumb: { table: { disable: true } },
    onRemoveThumb: { table: { disable: true } },
    renderTrack: { table: { disable: true } },
    renderReadout: { table: { disable: true } },
    className: { table: { disable: true } },
    thumbCount: {
      name: 'Thumb count',
      description: 'Playground-only: how many thumbs the slider starts with.',
      control: { type: 'range', min: 1, max: 8, step: 1 },
    },
  } as never,
};

export default meta;
type Story = StoryObj<typeof Slider>;

function Wrapper({ initial, ...rest }: { initial: Thumb[] } & Omit<Parameters<typeof Slider>[0], 'thumbs' | 'onChange'>) {
  const [thumbs, setThumbs] = useState<Thumb[]>(initial);
  return <Slider {...rest} thumbs={thumbs} onChange={setThumbs} />;
}

export const Single: Story = {
  render: (args) => <Wrapper {...args} initial={[{ value: 0.4 }]} />,
};

export const Pair: Story = {
  args: { constraint: 'ordered' },
  render: (args) => <Wrapper {...args} initial={[{ value: 0.25 }, { value: 0.75 }]} />,
};

export const ThreeStops: Story = {
  render: (args) => (
    <Wrapper
      {...args}
      initial={[
        { value: 0, label: 'A' },
        { value: 0.5, label: 'B' },
        { value: 1, label: 'C' },
      ]}
    />
  ),
};

export const HueGradientTrack: Story = {
  args: { step: 0.001, trackHeight: 20 },
  render: (args) => (
    <Wrapper
      {...args}
      initial={[{ value: 0.5, shape: 'notched' }]}
      renderTrack={paintGradientTrack({
        gradient: (t) => oklchToHex(0.7, 0.18, t * 360),
        samples: 24,
      })}
    />
  ),
};

function ActiveRangeHatchStory({ args }: { args: Omit<Parameters<typeof Slider>[0], 'thumbs' | 'onChange' | 'renderTrack'> }) {
  const [thumbs, setThumbs] = useState<Thumb[]>([
    { value: 0.3, shape: 'notched' },
    { value: 0.75, shape: 'notched' },
  ]);
  const activeRange: [number, number] = [thumbs[0].value, thumbs[1].value];
  return (
    <Slider
      {...args}
      thumbs={thumbs}
      onChange={setThumbs}
      renderTrack={paintGradientTrack({
        gradient: (t) => oklchToHex(0.7, 0.18, t * 360),
        samples: 24,
        activeRange,
      })}
    />
  );
}

export const ActiveRangeHatch: Story = {
  args: { step: 0.001, trackHeight: 20, constraint: 'ordered' },
  render: (args) => <ActiveRangeHatchStory args={args} />,
};

export const NotchedThumbs: Story = {
  render: (args) => (
    <Wrapper
      {...args}
      initial={[{ value: 0.2, shape: 'notched' }, { value: 0.8, shape: 'notched' }]}
    />
  ),
};

function evenlySpacedThumbs(n: number, min: number, max: number): Thumb[] {
  if (n <= 1) return [{ value: (min + max) / 2 }];
  return Array.from({ length: n }, (_, i) => ({ value: min + (i / (n - 1)) * (max - min) }));
}

function PlaygroundView({
  thumbCount,
  ...sliderArgs
}: { thumbCount: number } & Omit<Parameters<typeof Slider>[0], 'thumbs' | 'onChange'>) {
  const [, updateArgs] = useArgs();
  const [thumbs, setThumbs] = useState<Thumb[]>(() =>
    evenlySpacedThumbs(thumbCount, sliderArgs.min, sliderArgs.max),
  );
  // Sync thumbs to the count arg. Add new thumbs at the high end; remove from
  // the end so dragging during a count change doesn't yank a different thumb.
  useEffect(() => {
    setThumbs((prev) => {
      if (prev.length === thumbCount) return prev;
      if (prev.length < thumbCount) {
        const extra = Array.from({ length: thumbCount - prev.length }, (_, i) => {
          const t = (prev.length + i) / (thumbCount - 1 || 1);
          return { value: sliderArgs.min + t * (sliderArgs.max - sliderArgs.min) };
        });
        return [...prev, ...extra];
      }
      return prev.slice(0, thumbCount);
    });
  }, [thumbCount, sliderArgs.min, sliderArgs.max]);
  const setCount = (n: number) => updateArgs({ thumbCount: Math.max(1, Math.min(8, n)) });
  const btnStyle: React.CSSProperties = {
    fontSize: 11,
    padding: '3px 10px',
    cursor: 'pointer',
    background: 'var(--wzl-surface-raised)',
    color: 'var(--wzl-fg)',
    border: '1px solid var(--wzl-border)',
    borderRadius: 4,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Slider {...sliderArgs} thumbs={thumbs} onChange={setThumbs} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--wzl-fg-muted)' }}>
        <button type="button" style={btnStyle} disabled={thumbCount <= 1} onClick={() => setCount(thumbCount - 1)}>− Remove</button>
        <button type="button" style={btnStyle} disabled={thumbCount >= 8} onClick={() => setCount(thumbCount + 1)}>+ Add</button>
        <span>{thumbs.length} thumb{thumbs.length === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

export const Playground: Story = {
  args: { trackHeight: 12, readoutPlacement: 'below-thumb' } as never,
  render: (args) => <PlaygroundView {...(args as unknown as Parameters<typeof PlaygroundView>[0])} />,
};
