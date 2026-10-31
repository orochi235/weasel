import type { Meta, StoryObj } from '@weasel-js/forge';
import { Powerline } from '@weasel-js/ui/components/Powerline';
import type { EdgeCap } from '@weasel-js/ui/components/Powerline';
import { BADGE_VARIANT_ICONS } from '@weasel-js/ui/components/Badge';
import { BADGE_LOOKS, lookProps } from '../Badge/looks';
import s from './Powerline.module.css';

const ALL_CAPS: EdgeCap[] = ['flat', 'chevron', 'slant', 'slant-up', 'round', 'scallop', 'puzzle', 'concave-chevron'];

const meta: Meta<typeof Powerline> = {
  title: 'ui/Foundations/Powerline',
  component: Powerline,
  args: {
    variant: 'solid',
    size: 'sm',
    segments: [
      { text: 'main', emphasis: 'high', endCap: 'chevron' },
      { text: '✓ 12', grade: 'info', endCap: 'slant' },
      { text: '↑3 ↓1', grade: 'warn', endCap: 'scallop' },
      { text: '~/proj', emphasis: 'low' },
    ],
  },
  argTypes: {
    startCap: { control: 'select', options: ALL_CAPS },
    variant: { control: { type: 'inline-radio', icons: BADGE_VARIANT_ICONS }, options: ['outline', 'solid', 'subtle'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    depth: { control: { type: 'range', min: 0, max: 20, step: 0.5 } },
    gap: { control: 'text', description: 'CSS length between segments. Default: 0.2em. Pass 0 for flush.' },
  },
};
export default meta;

type Story = StoryObj<typeof Powerline>;

export const ClassicPrompt: Story = {};

export const EveryCapInOneRow: Story = {
  tags: ['gallery'],
  args: {
    segments: [
      ...ALL_CAPS.slice(0, -1).map((cap, i) => ({
        text: typeof cap === 'string' ? cap : `custom-${i}`,
        endCap: cap,
        ...lookProps(BADGE_LOOKS[i % BADGE_LOOKS.length]!),
      })),
      { text: 'end' },
    ],
  },
};

export const CapMatrix: Story = {
  tags: ['gallery'],
  render: (args) => (
    <div className={s.matrix}>
      {ALL_CAPS.map((cap) => (
        <Powerline {...args}
          key={String(cap)}
          segments={[
            { text: String(cap), emphasis: 'high', endCap: cap },
            { text: 'next', grade: 'info' },
          ]}
        />
      ))}
    </div>
  ),
};

export const SubtleVariant: Story = {
  args: { variant: 'subtle' },
};

export const OutlineVariant: Story = {
  args: { variant: 'outline' },
};

export const SizeMd: Story = {
  args: { size: 'md' },
};

export const CustomEdgeProfile: Story = {
  args: {
    segments: [
      {
        text: 'wave',
        emphasis: 'high',
        endCap: (t, d) => Math.sin(t * Math.PI * 4) * d * 0.6,
      },
      { text: 'next', grade: 'info' },
    ],
  },
};

export const FlushNoGap: Story = {
  args: { gap: 0 },
};

export const MixedVariants: Story = {
  args: {
    segments: [
      { text: 'main', emphasis: 'high', variant: 'solid', endCap: 'chevron' },
      { text: 'tracked', grade: 'info', variant: 'outline', endCap: 'chevron' },
      { text: 'dirty', grade: 'warn', variant: 'subtle' },
    ],
  },
};

export const PuzzleChain: Story = {
  args: {
    gap: 0,
    depth: 8,
    size: 'md',
    segments: [
      { text: 'tool', emphasis: 'high', endCap: 'puzzle' },
      { text: 'drag', grade: 'info', endCap: 'puzzle' },
      { text: 'move', grade: 'warn', endCap: 'puzzle' },
      { text: 'node-7', emphasis: 'low' },
    ],
  },
};

export const LongStripCookbook: Story = {
  args: {
    segments: [
      { text: '⎈ k8s', grade: 'info', endCap: 'chevron' },
      { text: 'prod', grade: 'danger', endCap: 'chevron' },
      { text: 'us-west-2', grade: 'warn', endCap: 'chevron' },
      { text: 'deployment/api', emphasis: 'low', endCap: 'chevron' },
      { text: 'v2.3.1', emphasis: 'high' },
    ],
  },
};
