import { f, meta, story } from '@weasel-js/forge';
import type { CSSProperties } from 'react';
import { frames, range, Sequence } from '@weasel-js/ui/components/Sequence';
import { oklchDegToHex } from '@weasel-js/paint';
import s from './Sequence.stories.module.css';

/** One component repeated over the steps of a parameter, the rest held: a scrubber's values, all at once. */
export default meta({ title: 'ui/Sequence' });

export const Digits = story({
  config: f.schema({
    from: f.number(0).range(0, 9).step(1).label('From'),
    to: f.number(9).range(0, 9).step(1).label('To'),
    layout: f.enum('wrap', ['wrap', 'strip']).radio().label('Layout'),
  }),
  render: ({ config }) => {
    const c = config as { from: number; to: number; layout: 'wrap' | 'strip' };
    return (
      <Sequence label="Digits" layout={c.layout} sweep={range({ from: c.from, to: c.to, step: 1 })} caption={false}>
        {(d) => <span className={s.digit}>{d}</span>}
      </Sequence>
    );
  },
});

/** Two parameters as a grid: every hue against every lightness. */
export const Grid = story({
  config: f.schema({
    hues: f.number(6).range(2, 12).step(1).label('Hues'),
    chroma: f.number(0.12).range(0, 0.3).step(0.01).label('Chroma'),
  }),
  render: ({ config }) => {
    const c = config as { hues: number; chroma: number };
    return (
      <Sequence
        label="Hue by lightness"
        sweep={range({ from: 0.3, to: 0.9, step: 0.15, label: (l) => l.toFixed(2) })}
        across={range({ from: 0, to: 360 - 360 / c.hues, count: c.hues, label: (h) => `${Math.round(h)}°` })}
      >
        {(l, h) => <span className={s.swatch} style={{ '--swatch': oklchDegToHex(l, c.chroma, h) } as CSSProperties} />}
      </Sequence>
    );
  },
});

/** Time as the parameter: a hand turning once a second, every `every` ms of one pass. */
export const Frames = story({
  config: f.schema({
    every: f.number(125).range(25, 500).step(25).suffix('ms').label('Every'),
  }),
  render: ({ config }) => {
    const { every } = config as { every: number };
    return (
      <Sequence label="One turn" sweep={frames({ duration: 1000, loop: true }, { every })}>
        {(t) => (
          <span className={s.dial}>
            <span className={s.hand} style={{ '--turn': `${t / 1000}turn` } as CSSProperties} />
          </span>
        )}
      </Sequence>
    );
  },
});
