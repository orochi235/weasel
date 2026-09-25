import type { Meta, StoryObj } from '@weasel-js/forge';
import { Code, type CodeStatus } from './Code';

const meta: Meta<typeof Code> = {
  title: 'ui/Foundations/Code',
  component: Code,
  args: { children: 'editor.insert', status: 'neutral', variant: 'subtle' },
  argTypes: {
    status: { control: 'inline-radio', options: ['neutral', 'muted', 'accent', 'success', 'warn', 'danger'] },
    variant: { control: 'inline-radio', options: ['subtle', 'plain'] },
    size: { control: 'inline-radio', options: [undefined, 'xs', 'sm', 'md'] },
  },
};
export default meta;
type Story = StoryObj<typeof Code>;

export const Default: Story = {};

const STATUSES: CodeStatus[] = ['neutral', 'muted', 'accent', 'success', 'warn', 'danger'];

export const Statuses: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 8, justifyContent: 'start' }}>
      {STATUSES.flatMap((t) => [
        <Code key={`${t}-s`} status={t}>{t}</Code>,
        <Code key={`${t}-p`} status={t} variant="plain">{t}</Code>,
      ])}
    </div>
  ),
};

/** `tone` says which of its peers a span is, from the theme's tone list. */
export const PeerTones: Story = {
  render: () => (
    <p>
      {[0, 1, 2, 3, 4, 5].map((tone) => (
        <span key={tone}>
          <Code tone={tone}>{`peer.${tone}`}</Code>{' '}
        </span>
      ))}
    </p>
  ),
};

/** A diff of two sets reads as added and removed members. */
export const Diff: Story = {
  render: () => (
    <p>
      vs <strong>minimal</strong>: <Code status="success">+lasso</Code>{' '}
      <Code status="success">+polygon</Code> <Code status="danger">−marquee</Code>
    </p>
  ),
};

/** Unsized, the span follows the text around it; a long signature wraps
 *  inside the chip, which repeats its padding on every line. */
export const InRunningText: Story = {
  render: () => (
    <p style={{ maxWidth: 320, lineHeight: 1.6 }}>
      The dep resolves to <Code>(ctx: ToolCtx, bounds: Rect, params: Readonly&lt;Record&lt;string, unknown&gt;&gt;) =&gt; SceneNode | null</Code>{' '}
      and is overridden with <Code status="accent">useDepSource('insert', …)</Code>.
    </p>
  ),
};
