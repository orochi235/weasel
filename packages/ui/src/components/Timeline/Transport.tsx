import type { ReactElement } from 'react';
import { multiplier, qty } from '@weasel-js/quantity';
import { DetentSlider } from '../DetentSlider';
import { PauseIcon, PlayIcon } from '../../icons';
import s from './Timeline.module.css';

const RATE = multiplier({ symbol: 'x' });

/** Playback rates the transport offers. */
const RATES = [0.25, 0.5, 1, 2, 4] as const;

/** Props for {@link Transport}. Times are in ms. */
export interface TransportProps {
  paused: boolean;
  /** A `TimelineHandle`'s loop policy. The switch shows any value but
   *  `false` or `0` as on, and toggles between `true` and `false`. */
  loop: boolean | number;
  /** Playback speed multiplier. A rate off the offered detents gets one of its own. */
  rate: number;
  playhead: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onLoopChange: (loop: boolean | number) => void;
  onRateChange: (rate: number) => void;
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;
const rateText = (r: number): string => qty(r, RATE).text;

/** Play/pause, a loop switch, a rate slider, and the playhead over the
 *  duration in seconds. Holds no state: every control reports through a callback. */
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
          items={rates.map((r) => ({ value: r, ariaLabel: qty(r, RATE).spoken }))}
          value={rate}
          onChange={onRateChange}
          formatLabel={rateText}
          labels="none"
          className={s.rateSlider}
        />
        <span className={s.rateReadout}>
          <span>{rateText(rate)}</span>
          <span className={s.sizer} aria-hidden="true">
            {rates.map((r) => <span key={r}>{rateText(r)}</span>)}
          </span>
        </span>
      </div>

      <span className={s.time}>
        <span data-testid="timeline-time">
          {seconds(Math.min(Math.max(playhead, 0), duration))} / {seconds(duration)}
        </span>
        <span className={s.sizer} aria-hidden="true">
          <span>{seconds(duration)} / {seconds(duration)}</span>
        </span>
      </span>
    </div>
  );
}
