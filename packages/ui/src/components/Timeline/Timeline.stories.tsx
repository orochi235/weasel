import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Track } from '@weasel-js/core';
import { Timeline } from './Timeline';

const meta: Meta<typeof Timeline> = {
  title: 'weasel-ui/Timeline',
  component: Timeline,
  // Storybook's `theme` global sets `data-theme`, which nothing in
  // tokens.css reads (`applyTheme` writes `data-wzl-mode`) — without this,
  // a URL-driven "both themes" check verifies the `:root` dark default twice.
  decorators: [
    (Story, context) => (
      <div data-wzl-mode={context.globals.theme === 'light' ? 'light' : 'dark'}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

function Harness({ initial, mode }: { initial: Track[]; mode?: 'dope' | 'graph' }): ReactElement {
  const [tracks, setTracks] = useState(initial);
  const [playhead, setPlayhead] = useState(0);
  return (
    // Fixed height is load-bearing: <Timeline> is a flex column with a
    // scrolling `.lanes`, so a container with no height renders as a strip.
    <div style={{ height: 240, width: 640 }}>
      <Timeline
        tracks={tracks}
        duration={2000}
        playhead={playhead}
        mode={mode}
        onChange={setTracks}
        onScrub={setPlayhead}
        renderKeyEditor={({ key }) => <span>value: {String(key.value)}</span>}
      />
    </div>
  );
}

const flat = (): Track[] => ([
  { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 800, value: 120, easing: 'easeOutCubic' }, { t: 1600, value: 40 }], onTick: () => {} },
  { kind: 'sampled', label: 'opacity', keys: [{ t: 0, value: 0 }, { t: 400, value: 1 }], onTick: () => {} },
  { kind: 'event', label: 'footstep', events: [{ t: 300, fire: () => {} }, { t: 900, fire: () => {} }, { t: 1500, fire: () => {} }] },
] as Track[]);

const withNested = (): Track[] => ([
  ...flat(),
  {
    kind: 'timeline', label: 'blink', at: 600,
    timeline: { tracks: [{ kind: 'sampled', label: 'lid', keys: [{ t: 0, value: 1 }, { t: 200, value: 0 }], onTick: () => {} }], duration: 400 },
  },
] as Track[]);

export const Dope: StoryObj = { render: () => <Harness initial={flat()} /> };
export const Graph: StoryObj = { render: () => <Harness initial={flat()} mode="graph" /> };
export const Nested: StoryObj = { render: () => <Harness initial={withNested()} /> };
