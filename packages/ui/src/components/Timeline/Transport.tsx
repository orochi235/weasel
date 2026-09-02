import type { ReactElement } from 'react';
import s from './Timeline.module.css';

/** Playback rates the transport offers. */
const RATES = [0.25, 0.5, 1, 2, 4] as const;

export interface TransportProps {
  paused: boolean;
  loop: boolean | number;
  rate: number;
  playhead: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onLoopChange: (loop: boolean | number) => void;
  onRateChange: (rate: number) => void;
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

export function Transport(props: TransportProps): ReactElement {
  const { paused, loop, rate, playhead, duration, onPlay, onPause, onLoopChange, onRateChange } = props;
  const looping = loop !== false && loop !== 0;

  return (
    <div className={s.transport}>
      <button
        type="button"
        className={s.transportButton}
        aria-label={paused ? 'Play' : 'Pause'}
        onClick={paused ? onPlay : onPause}
      >
        {paused ? '▶' : '❚❚'}
      </button>

      <span className={s.time} data-testid="timeline-time">
        {seconds(playhead)} / {seconds(duration)}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={looping}
        aria-label="Loop"
        className={s.transportButton}
        onClick={() => onLoopChange(!looping)}
      >
        ⟲
      </button>

      <label className={s.rate}>
        Rate
        <select value={rate} onChange={(e) => onRateChange(Number(e.target.value))}>
          {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
        </select>
      </label>
    </div>
  );
}
