import type { Meta, StoryObj } from '@weasel-js/forge';
import { Powerline } from './Powerline';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import s from './Powerline.module.css';

const ALL_CAPS: EdgeCap[] = ['flat', 'chevron', 'slant', 'slant-up', 'round', 'scallop', 'concave-chevron'];

const meta: Meta<typeof Powerline> = {
  title: 'ui/Foundations/Powerline',
  component: Powerline,
  args: {
    variant: 'solid',
    size: 'sm',
    segments: [
      { text: 'main', status: 'accent', endCap: 'chevron' },
      { text: '✓ 12', status: 'info', endCap: 'slant' },
      { text: '↑3 ↓1', status: 'warn', endCap: 'scallop' },
      { text: '~/proj', status: 'muted' },
    ],
  },
  argTypes: {
    startCap: { control: 'select', options: ALL_CAPS },
    variant: { control: 'inline-radio', options: ['outline', 'solid', 'subtle'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    depth: { control: { type: 'range', min: 0, max: 20, step: 0.5 } },
    gap: { control: 'text', description: 'CSS length between segments. Default: 0.2em. Pass 0 for flush.' },
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
        status: (['accent', 'info', 'warn', 'danger', 'muted', 'neutral'] as const)[i % 6],
      })),
      { text: 'end', status: 'neutral' as const },
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
            { text: String(cap), status: 'accent', endCap: cap },
            { text: 'next', status: 'info' },
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
        status: 'accent',
        endCap: (t, d) => Math.sin(t * Math.PI * 4) * d * 0.6,
      },
      { text: 'next', status: 'info' },
    ],
  },
};

export const FlushNoGap: Story = {
  args: { gap: 0 },
};

export const MixedVariants: Story = {
  args: {
    segments: [
      { text: 'main', status: 'accent', variant: 'solid', endCap: 'chevron' },
      { text: 'tracked', status: 'info', variant: 'outline', endCap: 'chevron' },
      { text: 'dirty', status: 'warn', variant: 'subtle' },
    ],
  },
};

export const LongStripCookbook: Story = {
  args: {
    segments: [
      { text: '⎈ k8s', status: 'info', endCap: 'chevron' },
      { text: 'prod', status: 'danger', endCap: 'chevron' },
      { text: 'us-west-2', status: 'warn', endCap: 'chevron' },
      { text: 'deployment/api', status: 'muted', endCap: 'chevron' },
      { text: 'v2.3.1', status: 'accent' },
    ],
  },
};
