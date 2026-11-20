import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SpanStrip, type SpanStripProps, type SpanStripSpan } from '@weasel-js/ui/components/SpanStrip';

const RUN: SpanStripSpan[] = [
  { id: 'review', label: 'review', ms: 300_000, state: 'done', color: 'var(--wzl-swatch-violet)' },
  { id: 'match', label: 'match', ms: 30_000, state: 'done', color: 'var(--wzl-swatch-teal)' },
  { id: 'fix', label: 'fix · 2 commits', ms: 1_080_000, state: 'active', color: 'var(--wzl-swatch-amber)' },
  { id: 'patch', label: 'patch', ms: 30_000, color: 'var(--wzl-swatch-fuchsia)' },
];

const meta: Meta<typeof SpanStrip> = {
  title: 'ui/SpanStrip',
  component: SpanStrip,
  args: { spans: RUN, at: 700_000, 'aria-label': 'Run' },
};
export default meta;
type Story = StoryObj<typeof SpanStrip>;

/** A run partway through its fix step: what is done, and the step under way up to now, filled in their colors. */
export const Progress: Story = {};

/** Every span finished; the last one stopped short. */
export const Failed: Story = {
  args: {
    at: 1_440_000,
    spans: RUN.map((s) => (s.id === 'patch' ? { ...s, label: 'conflict', state: 'failed', color: 'var(--wzl-danger)' } : { ...s, state: 'done' })),
  },
};

/** With `onSeek`, a slider: press or drag to move the playhead, or use the arrows, Home and End. */
export const Seekable: Story = {
  render: (args) => <Seeking {...args} />,
};

function Seeking(props: SpanStripProps) {
  const [at, setAt] = useState(props.at);
  return <SpanStrip {...props} at={at} onSeek={(ms) => setAt(ms)} />;
}
