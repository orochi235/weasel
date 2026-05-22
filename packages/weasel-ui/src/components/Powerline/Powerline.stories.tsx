import type { Meta, StoryObj } from '@storybook/react-vite';
import { Powerline } from './Powerline';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import s from './Powerline.module.css';

const ALL_CAPS: EdgeCap[] = ['flat', 'chevron', 'slant', 'slant-up', 'round', 'scallop', 'concave-chevron'];

const meta: Meta<typeof Powerline> = {
  title: 'weasel-ui/Foundations/Powerline',
  component: Powerline,
  args: {
    variant: 'solid',
    size: 'sm',
    segments: [
      { text: 'main', tone: 'accent', endCap: 'chevron' },
      { text: '✓ 12', tone: 'info', endCap: 'slant' },
      { text: '↑3 ↓1', tone: 'warn', endCap: 'scallop' },
      { text: '~/proj', tone: 'muted' },
    ],
  },
  argTypes: {
    startCap: { control: 'select', options: ALL_CAPS },
    variant: { control: 'inline-radio', options: ['outline', 'solid', 'subtle'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    depth: { control: { type: 'range', min: 0, max: 20, step: 0.5 } },
    gap: { control: 'text', description: 'CSS length between segments. Default: 0.1em. Pass 0 for flush.' },
  },
};
export default meta;

type Story = StoryObj<typeof Powerline>;

export const ClassicPrompt: Story = {};

export const EveryCapInOneRow: Story = {
  args: {
    segments: [
      ...ALL_CAPS.slice(0, -1).map((cap, i) => ({
        text: typeof cap === 'string' ? cap : `custom-${i}`,
        endCap: cap,
        tone: (['accent', 'info', 'warn', 'danger', 'muted', 'neutral'] as const)[i % 6],
      })),
      { text: 'end', tone: 'neutral' as const },
    ],
  },
};

export const CapMatrix: Story = {
  render: () => (
    <div className={s.matrix}>
      {ALL_CAPS.map((cap) => (
        <Powerline
          key={String(cap)}
          variant="solid"
          size="sm"
          segments={[
            { text: String(cap), tone: 'accent', endCap: cap },
            { text: 'next', tone: 'info' },
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
        tone: 'accent',
        endCap: (t, d) => Math.sin(t * Math.PI * 4) * d * 0.6,
      },
      { text: 'next', tone: 'info' },
    ],
  },
};

export const FlushNoGap: Story = {
  args: { gap: 0 },
};

export const MixedVariants: Story = {
  args: {
    segments: [
      { text: 'main', tone: 'accent', variant: 'solid', endCap: 'chevron' },
      { text: 'tracked', tone: 'info', variant: 'outline', endCap: 'chevron' },
      { text: 'dirty', tone: 'warn', variant: 'subtle' },
    ],
  },
};

export const LongStripCookbook: Story = {
  args: {
    segments: [
      { text: '⎈ k8s', tone: 'info', endCap: 'chevron' },
      { text: 'prod', tone: 'danger', endCap: 'chevron' },
      { text: 'us-west-2', tone: 'warn', endCap: 'slant' },
      { text: 'deployment/api', tone: 'muted', endCap: 'round' },
      { text: 'v2.3.1', tone: 'accent' },
    ],
  },
};
