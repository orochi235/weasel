import type { ReactElement } from 'react';
import { DetentSlider } from '../DetentSlider';
import { PauseIcon, PlayIcon } from '../../icons';
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
  // The handle's scale is whatever anything holding it set, so an off-list rate
  // gets its own detent — `DetentSlider` would otherwise round it to the
  // nearest and label the thumb with a rate the timeline is not running at.
  const rates = RATES.includes(rate as typeof RATES[number])
    ? (RATES as readonly number[])
    : [...RATES, rate].sort((a, b) => a - b);

  return (
    <div className={s.transport}>
      <button
        type="button"
        className={s.transportButton}
        aria-label={paused ? 'Play' : 'Pause'}
        onClick={paused ? onPlay : onPause}
      >
        {paused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
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

      <div className={s.rate}>
        Rate
        <DetentSlider
          ariaLabel="Rate"
          items={rates}
          value={rate}
          onChange={onRateChange}
          formatLabel={(r) => `${r}x`}
          labels="none"
          className={s.rateSlider}
        />
        <span className={s.rateReadout}>{rate}x</span>
      </div>
    </div>
  );
}
