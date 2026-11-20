import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SpanStrip, SpanStrips, type SpanStripProps, type SpanStripSpan } from '@weasel-js/ui/components/SpanStrip';

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

const MIN = 60_000;

/** Several strips on one clock with `SpanStrips`: flush, one border line between neighbors, one playhead down the
 *  stack, and a ruler in minutes. A row that began late starts further right; spans not begun are dimmed. */
export const Stacked: Story = {
  render: () => (
    <SpanStrips aria-label="Lanes" window={{ from: 0, to: 40 * MIN }} at={26 * MIN}
      ruler={{ steps: [5 * MIN, 10 * MIN], format: (ms) => `${ms / MIN}m` }} rows={[
        { id: 'one', 'aria-label': 'core.ops', lead: 'core.ops', spans: [
          { id: 'r', label: '5+2', ms: 4 * MIN, start: 0, state: 'done', color: 'var(--wzl-swatch-violet)' },
          { id: 'm', label: '2 shared', ms: 0.5 * MIN, state: 'done', color: 'var(--wzl-swatch-teal)' },
          { id: 'f', label: 'studio · 21m', ms: 21.5 * MIN, state: 'active', color: 'var(--wzl-swatch-amber)' },
          { id: 'p', label: '', ms: 0.5 * MIN, color: 'var(--wzl-swatch-fuchsia)' },
        ] },
        { id: 'two', 'aria-label': 'geom', lead: 'geom', spans: [
          { id: 'r', label: 'teitou · 8m', ms: 8 * MIN, start: 18 * MIN, state: 'active', color: 'var(--wzl-swatch-violet)' },
          { id: 'm', label: '', ms: 0.5 * MIN, color: 'var(--wzl-swatch-teal)' },
          { id: 'f', label: '', ms: 18 * MIN, color: 'var(--wzl-swatch-amber)' },
        ] },
      ]} />
  ),
};

/** With `onSeek`, a slider: press or drag to move the playhead, or use the arrows, Home and End. */
export const Seekable: Story = {
  render: (args) => <Seeking {...args} />,
};

function Seeking(props: SpanStripProps) {
  const [at, setAt] = useState(props.at);
  return <SpanStrip {...props} at={at} onSeek={(ms) => setAt(ms)} />;
}
