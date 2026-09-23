import type { Meta, StoryObj } from '@weasel-js/forge';
import { Code, type CodeTone } from './Code';

const meta: Meta<typeof Code> = {
  title: 'ui/Foundations/Code',
  component: Code,
  args: { children: 'editor.insert', tone: 'neutral', variant: 'subtle' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['neutral', 'muted', 'accent', 'success', 'warn', 'danger'] },
    variant: { control: 'inline-radio', options: ['subtle', 'plain'] },
    size: { control: 'inline-radio', options: [undefined, 'xs', 'sm', 'md'] },
  },
};
export default meta;
type Story = StoryObj<typeof Code>;

export const Default: Story = {};

const TONES: CodeTone[] = ['neutral', 'muted', 'accent', 'success', 'warn', 'danger'];

export const Tones: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 8, justifyContent: 'start' }}>
      {TONES.flatMap((t) => [
        <Code key={`${t}-s`} tone={t}>{t}</Code>,
        <Code key={`${t}-p`} tone={t} variant="plain">{t}</Code>,
      ])}
    </div>
  ),
};

/** A diff of two sets reads as added and removed members. */
export const Diff: Story = {
  render: () => (
    <p>
      vs <strong>minimal</strong>: <Code tone="success">+lasso</Code>{' '}
      <Code tone="success">+polygon</Code> <Code tone="danger">−marquee</Code>
    </p>
  ),
};

/** Unsized, the span follows the text around it; a long signature wraps
 *  inside the chip, which repeats its padding on every line. */
export const InRunningText: Story = {
  render: () => (
    <p style={{ maxWidth: 320, lineHeight: 1.6 }}>
      The dep resolves to <Code>(ctx: ToolCtx, bounds: Rect, params: Readonly&lt;Record&lt;string, unknown&gt;&gt;) =&gt; SceneNode | null</Code>{' '}
      and is overridden with <Code tone="accent">useDepSource('insert', …)</Code>.
    </p>
  ),
};
