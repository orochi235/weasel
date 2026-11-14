import type { Meta, StoryObj } from '@weasel-js/forge';
import { Powerline } from '@weasel-js/ui/components/Powerline';
import type { EdgeCap } from '@weasel-js/ui/components/Powerline';
import { Badge, BADGE_VARIANT_ICONS } from '@weasel-js/ui/components/Badge';
import { BADGE_LOOKS, lookProps } from '../Badge/looks';
import s from './Powerline.module.css';

const ALL_CAPS: EdgeCap[] = ['flat', 'chevron', 'slant', 'slant-up', 'round', 'scallop', 'puzzle', 'concave-chevron'];

const classic = (
  <>
    <Badge emphasis="high" endCap="chevron">main</Badge>
    <Badge grade="info" endCap="slant">✓ 12</Badge>
    <Badge grade="warn" endCap="scallop">↑3 ↓1</Badge>
    <Badge emphasis="low">~/proj</Badge>
  </>
);

const meta: Meta<typeof Powerline> = {
  title: 'ui/Powerline',
  component: Powerline,
  args: { variant: 'solid', size: 'sm' },
  argTypes: {
    startCap: { control: 'select', options: ALL_CAPS },
    variant: { control: { type: 'inline-radio', icons: BADGE_VARIANT_ICONS }, options: ['outline', 'solid', 'subtle'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    depth: { control: { type: 'range', min: 0, max: 20, step: 0.5 } },
    gap: { control: 'text', description: 'CSS length between segments. Default: 0.2em. Pass 0 for flush.' },
  },
  render: (args) => <Powerline {...args}>{classic}</Powerline>,
};
export default meta;

type Story = StoryObj<typeof Powerline>;

export const ClassicPrompt: Story = {};

export const EveryCapInOneRow: Story = {
  tags: ['gallery'],
  render: (args) => (
    <Powerline {...args}>
      {ALL_CAPS.slice(0, -1).map((cap, i) => (
        <Badge key={String(cap)} endCap={cap} {...lookProps(BADGE_LOOKS[i % BADGE_LOOKS.length]!)}>
          {typeof cap === 'string' ? cap : `custom-${i}`}
        </Badge>
      ))}
      <Badge>end</Badge>
    </Powerline>
  ),
};

export const CapMatrix: Story = {
  tags: ['gallery'],
  render: (args) => (
    <div className={s.matrix}>
      {ALL_CAPS.map((cap) => (
        <Powerline {...args} key={String(cap)}>
          <Badge emphasis="high" endCap={cap}>{String(cap)}</Badge>
          <Badge grade="info">next</Badge>
        </Powerline>
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

const wave: EdgeCap = (t, d) => Math.sin(t * Math.PI * 4) * d * 0.6;

export const CustomEdgeProfile: Story = {
  render: (args) => (
    <Powerline {...args}>
      <Badge emphasis="high" endCap={wave}>wave</Badge>
      <Badge grade="info">next</Badge>
    </Powerline>
  ),
};

export const FlushNoGap: Story = {
  args: { gap: 0 },
};

export const MixedVariants: Story = {
  render: (args) => (
    <Powerline {...args}>
      <Badge emphasis="high" variant="solid" endCap="chevron">main</Badge>
      <Badge grade="info" variant="outline" endCap="chevron">tracked</Badge>
      <Badge grade="warn" variant="subtle">dirty</Badge>
    </Powerline>
  ),
};

export const PuzzleChain: Story = {
  args: { gap: 0, depth: 8, size: 'md' },
  render: (args) => (
    <Powerline {...args}>
      <Badge emphasis="high" endCap="puzzle">tool</Badge>
      <Badge grade="info" endCap="puzzle">drag</Badge>
      <Badge grade="warn" endCap="puzzle">move</Badge>
      <Badge emphasis="low">node-7</Badge>
    </Powerline>
  ),
};

export const LongStripCookbook: Story = {
  render: (args) => (
    <Powerline {...args}>
      <Badge grade="info" endCap="chevron">⎈ k8s</Badge>
      <Badge grade="danger" endCap="chevron">prod</Badge>
      <Badge grade="warn" endCap="chevron">us-west-2</Badge>
      <Badge emphasis="low" endCap="chevron">deployment/api</Badge>
      <Badge emphasis="high">v2.3.1</Badge>
    </Powerline>
  ),
};
