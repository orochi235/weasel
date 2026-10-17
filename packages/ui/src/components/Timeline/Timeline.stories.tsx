import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { type Track, type TimelineHandle } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import { Timeline, type TimelineProps } from './Timeline';
import { AnimatedTimeline } from './AnimatedTimeline';

const meta: Meta<typeof Timeline> = {
  title: 'ui/Timeline',
  component: Timeline,
};
export default meta;

type Story = StoryObj<typeof Timeline>;

function Harness({ args, initial }: { args: TimelineProps; initial: Track[] }): ReactElement {
  const [tracks, setTracks] = useState(initial);
  const [playhead, setPlayhead] = useState(args.playhead);
  return (
    // Fixed height is load-bearing: <Timeline> is a flex column with a
    // scrolling `.lanes`, so a container with no height renders as a strip.
    <div style={{ height: 240, width: 640 }}>
      <Timeline
        {...args}
        tracks={tracks}
        playhead={playhead}
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

export const Dope: Story = {
  args: { duration: 2000, playhead: 0 },
  render: (args) => <Harness args={args} initial={flat()} />,
};
export const Graph: Story = {
  args: { duration: 2000, playhead: 0, mode: 'graph' },
  render: (args) => <Harness args={args} initial={flat()} />,
};
const bezier = (): Track[] => {
  const tracks = flat();
  const x = tracks[0] as { keys: { t: number; value: number; easing?: unknown }[] };
  x.keys[1] = { ...x.keys[1], easing: { bezier: [0.2, 0.9, 0.3, 1] } };
  return tracks;
};

export const GraphBezier: Story = {
  args: { duration: 2000, playhead: 0, mode: 'graph' },
  render: (args) => <Harness args={args} initial={bezier()} />,
};
export const Nested: Story = {
  args: { duration: 2000, playhead: 0 },
  render: (args) => <Harness args={args} initial={withNested()} />,
};

/** The transport bound to a running timeline: play/pause, loop, rate and a
 *  live playhead. The other stories render `<Transport>` with inert defaults. */
function LiveHarness(): ReactElement {
  const animator = useAnimator();
  const [handle, setHandle] = useState<TimelineHandle | null>(null);
  const tracks = useRef(flat());
  useEffect(() => {
    const tl = animator.timeline({ tracks: tracks.current, loop: true });
    setHandle(tl);
    return () => tl.cancel();
  }, [animator]);
  return (
    <div style={{ height: 240, width: 640 }}>
      {handle ? (
        <AnimatedTimeline
          handle={handle}
          renderKeyEditor={({ key }) => <span>value: {String(key.value)}</span>}
        />
      ) : null}
    </div>
  );
}

export const Live: Story = { render: () => <LiveHarness /> };
