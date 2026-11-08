import { meta, story, usePlayhead } from '@weasel-js/forge';
import { ClockFrames, fieldSweep } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { Sequence } from '@weasel-js/ui/components/Sequence';
import type { CSSProperties } from 'react';
import './ClockFrames.stories.less';

/** A clock-driven component three ways: live, every frame of one pass held still, and live again at each size its
 *  size field offers. The hand reads only `usePlayhead`; nothing passes it a time. */
export default meta({ title: 'labkit/ClockFrames', layout: 'fullscreen' });

const SIZE = f.number(64).range(32, 96).step(16).suffix('px').label('Dial size');

interface FramesConfig {
  seconds: number;
  every: number;
  size: number;
}

function Hand({ period, size }: { period: number; size: number }) {
  const t = usePlayhead();
  const style = {
    '--lk-cf-size': `${size}px`,
    '--lk-cf-turn': `${t / period}turn`,
  } as CSSProperties;
  return (
    <span className="lk-cf-dial" style={style}>
      <span className="lk-cf-hand" />
    </span>
  );
}

export const Frames = story({
  config: f.schema({
    seconds: f.number(2).range(1, 8).step(1).suffix('s').label('One turn'),
    every: f.number(250).range(50, 1000).step(50).suffix('ms').label('Frame every'),
    size: SIZE,
  }),
  timeline: (config) => ({ duration: config.seconds * 1000 }),
  render: ({ config }) => {
    const c = config as FramesConfig;
    const period = c.seconds * 1000;
    return (
      <div className="lk-cf-page">
        <section aria-label="Live">
          <h3 className="lk-cf-title">Live, on the story's clock</h3>
          <Hand period={period} size={c.size} />
        </section>
        <section aria-label="Frames">
          <h3 className="lk-cf-title">
            Every {c.every} ms of one turn, each on a clock held at its time
          </h3>
          <ClockFrames label="Frames" spec={{ duration: period, loop: true }} every={c.every}>
            <Hand period={period} size={c.size} />
          </ClockFrames>
        </section>
        <section aria-label="Sizes">
          <h3 className="lk-cf-title">Live at every size the size field offers</h3>
          <Sequence label="Sizes" sweep={fieldSweep(SIZE)}>
            {(size) => <Hand period={period} size={size} />}
          </Sequence>
        </section>
      </div>
    );
  },
});
