import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useAnimator, type Track, type TimelineHandle } from '@weasel-js/core';
import { Timeline } from './Timeline';
import { AnimatedTimeline } from './AnimatedTimeline';

const meta: Meta<typeof Timeline> = {
  title: 'weasel-ui/Timeline',
  component: Timeline,
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
const bezier = (): Track[] => {
  const tracks = flat();
  const x = tracks[0] as { keys: { t: number; value: number; easing?: unknown }[] };
  x.keys[1] = { ...x.keys[1], easing: { bezier: [0.2, 0.9, 0.3, 1] } };
  return tracks;
};

export const GraphBezier: StoryObj = { render: () => <Harness initial={bezier()} mode="graph" /> };
export const Nested: StoryObj = { render: () => <Harness initial={withNested()} /> };

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

export const Live: StoryObj = { render: () => <LiveHarness /> };
