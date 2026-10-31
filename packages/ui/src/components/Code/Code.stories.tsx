import type { Meta, StoryObj } from '@weasel-js/forge';
import { Code, CODE_VARIANT_ICONS } from '@weasel-js/ui/components/Code';
import { EMPHASIS_ICONS, GRADE_ICONS } from '../appearanceIcons';
import { EMPHASES, GRADES } from '@weasel-js/theme';
import { BADGE_LOOKS, lookProps } from '../Badge/looks';

const meta: Meta<typeof Code> = {
  title: 'ui/Foundations/Code',
  component: Code,
  args: { children: 'editor.insert', variant: 'subtle' },
  argTypes: {
    grade: { control: { type: 'inline-radio', icons: GRADE_ICONS }, options: [undefined, ...GRADES] },
    emphasis: { control: { type: 'inline-radio', icons: EMPHASIS_ICONS }, options: [undefined, ...EMPHASES] },
    variant: { control: { type: 'inline-radio', icons: CODE_VARIANT_ICONS }, options: ['subtle', 'plain'] },
    size: { control: 'inline-radio', options: [undefined, 'xs', 'sm', 'md'] },
  },
};
export default meta;
type Story = StoryObj<typeof Code>;

export const Default: Story = {};

export const Looks: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 8, justifyContent: 'start' }}>
      {BADGE_LOOKS.flatMap((t) => [
        <Code {...args} key={`${t}-s`} {...lookProps(t)}>{t}</Code>,
        <Code {...args} key={`${t}-p`} {...lookProps(t)} variant="plain">{t}</Code>,
      ])}
    </div>
  ),
};

/** `tint` says which of its peers a span is, from the theme's tint list. */
export const PeerTints: Story = {
  render: (args) => (
    <p>
      {[0, 1, 2, 3, 4, 5].map((tint) => (
        <span key={tint}>
          <Code {...args} tint={tint}>{`tint.${tint}`}</Code>{' '}
        </span>
      ))}
    </p>
  ),
};

/** A diff of two sets reads as added and removed members. */
export const Diff: Story = {
  render: (args) => (
    <p>
      vs <strong>minimal</strong>: <Code {...args} grade="success">+lasso</Code>{' '}
      <Code {...args} grade="success">+polygon</Code> <Code {...args} grade="danger">−marquee</Code>
    </p>
  ),
};

/** Unsized, the span follows the text around it; a long signature wraps
 *  inside the chip, which repeats its padding on every line. */
export const InRunningText: Story = {
  render: (args) => (
    <p style={{ maxWidth: 320, lineHeight: 1.6 }}>
      The dep commits through <Code {...args}>(bounds: {'{'} x: number; y: number; width: number; height: number {'}'}, extras: InsertExtras) =&gt; NodeId | null</Code>{' '}
      and is overridden with <Code {...args} emphasis="high">useDepSource('insert', …)</Code>.
    </p>
  ),
};
