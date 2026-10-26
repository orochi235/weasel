import { useEffect, useRef, useState } from 'react';
import { DrawCanvas } from '@weasel-js/core';
import {
  createAudioEngine, createScore, readScoreCue, scoreBar, scoreCues, scoreParams,
} from '@weasel-js/audio';
import type { AudioEngine, Score, ScoreMood, ScoreParams, ScoreState } from '@weasel-js/audio';
import { scoreRoll } from './score/scoreRoll';
import { Button } from '@weasel-js/ui/components/Button';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import s from './ScoreDemo.module.css';
import { DemoStage } from './DemoStage';

const ROLL = { width: 560, height: 230 };
/** The bar the roll shows while nothing plays: late enough into a cue that
 *  every layer it builds up to is in. */
const BUILT_BAR = 8;

type Axis = keyof ScoreMood;

/** Each axis, its ends in words, and the parameters `scoreParams` reads off it. */
const AXES: readonly {
  axis: Axis; min: number; low: string; high: string; reads: readonly (keyof ScoreParams)[];
}[] = [
  { axis: 'valence', min: -1, low: 'dark', high: 'bright', reads: ['mode', 'register', 'spread'] },
  { axis: 'tension', min: 0, low: 'settled', high: 'dissonant', reads: ['harmony', 'layers'] },
  {
    axis: 'urgency', min: 0, low: 'still', high: 'driving',
    reads: ['tempo', 'density', 'articulation', 'harmonicRhythm', 'attack'],
  },
];

const LABELS: Partial<Record<keyof ScoreParams, string>> = { harmonicRhythm: 'chord every' };

function shown(params: ScoreParams, key: keyof ScoreParams): string {
  switch (key) {
    case 'register': return `MIDI ${params.register}`;
    case 'spread': return `${params.spread} oct`;
    case 'tempo': return `${String(params.tempo).padStart(3)} bpm`;
    case 'density': return params.density === 0 ? 'no pulse' : `${params.density} to a beat`;
    case 'harmonicRhythm': return `${params.harmonicRhythm} bar${params.harmonicRhythm === 1 ? '' : 's'}`;
    case 'attack': return `${String(params.attack).padStart(3)} ms`;
    default: return String(params[key]);
  }
}

const sameMood = (a: ScoreMood, b: ScoreMood): boolean =>
  a.valence === b.valence && a.tension === b.tension && a.urgency === b.urgency;

export function ScoreDemo() {
  const [mood, setMood] = useState<ScoreMood>(scoreCues[1].mood);
  /** The bar the score last booked, while it plays. */
  const [heard, setHeard] = useState<ScoreState | null>(null);
  const kit = useRef<{ engine: AudioEngine; score: Score } | null>(null);

  useEffect(() => () => {
    kit.current?.engine.dispose();
    kit.current = null;
  }, []);

  const steer = (next: ScoreMood): void => {
    setMood(next);
    kit.current?.score.setMood(next);
  };

  // Built on the first press, not at mount: a context made before a gesture
  // starts suspended, and jsdom has none.
  const toggle = (): void => {
    if (kit.current?.score.playing()) {
      kit.current.score.stop();
      setHeard(null);
      return;
    }
    if (typeof AudioContext === 'undefined') return;
    if (!kit.current) {
      const engine = createAudioEngine({ buses: ['music'] });
      kit.current = { engine, score: createScore(engine, { mood, onBar: (state) => setHeard(state) }) };
    }
    const { engine, score } = kit.current;
    score.setMood(mood);
    void engine.unlock().then(() => score.start());
  };

  // While it plays, everything shown is the bar in force; a slider's move
  // lands on the next bar line, as it does in the sound.
  const cue = heard?.cue ?? readScoreCue(mood);
  const params = heard?.params ?? scoreParams(mood);
  const cueBar = heard?.cueBar ?? BUILT_BAR;
  const device = scoreCues.find((c) => c.name === cue.name)!.device;

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <Button pressed={heard !== null} onClick={toggle}>{heard ? 'stop' : 'play'}</Button>
        {scoreCues.map((c) => (
          <Button key={c.name} pressed={sameMood(mood, c.mood)} onClick={() => steer(c.mood)}>
            {c.name}
          </Button>
        ))}
        <span className={s.bar} data-testid="bar">
          {heard ? `bar ${heard.bar + 1}, ${heard.cueBar + 1} into the cue` : 'stopped'}
        </span>
      </div>
      <div className="ckd-row">
        <div className={s.stage}>
          <DemoStage width={ROLL.width} height={ROLL.height}>
            <DrawCanvas
              className="ckd-canvas"
              background={{ kind: 'solid', color: '#2a2622' }}
              draw={(size) => scoreRoll(scoreBar(params, cueBar), size)}
            />
          </DemoStage>
          <div className={s.cue}>
            <strong data-testid="cue">{cue.name}</strong>
            <span data-testid="device">{device}</span>
          </div>
          <dl className={s.weights}>
            {scoreCues.map((c) => (
              <div key={c.name}>
                <dt>{c.name}</dt>
                <dd className={s.share}>{`${Math.round(cue.weights[c.name] * 100)}%`}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="ckd-panel ckd-panel-wide">
          {AXES.map(({ axis, min, low, high, reads }) => (
            <section key={axis}>
              <div className="ckd-panel-title">{axis}</div>
              <div className={s.slider}>
                <span>{low}</span>
                <InlineRange
                  aria-label={axis} min={min} max={1} step={0.05}
                  value={mood[axis]} onChange={(e) => steer({ ...mood, [axis]: Number(e.target.value) })}
                />
                <span>{high}</span>
                <span className={s.value}>{mood[axis].toFixed(2)}</span>
              </div>
              <dl className={`ckd-meters ${s.params}`}>
                {reads.map((key) => (
                  <div key={key} className={s.param}>
                    <dt>{LABELS[key] ?? key}</dt>
                    <dd className={s.reading}>{shown(params, key)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
      <div className="ckd-hint">
        <code>createScore</code> writes music a bar at a time from a mood on three axes. Each
        slider sets one axis, and the rows under it are what <code>scoreParams</code> reads off
        that axis alone. The name under the roll is the cue <code>readScoreCue</code> finds
        nearest the mood, with the device that cue applies and each cue&apos;s share. The roll is{' '}
        <code>scoreBar</code> for those parameters: one bar, low notes at the bottom. While the
        score plays, everything shown comes from <code>onBar</code>, so a slider&apos;s move shows
        up on the next bar line, when it is heard.
      </div>
    </div>
  );
}
