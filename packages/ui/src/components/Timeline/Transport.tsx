import type { ReactElement } from 'react';
import { CLOCK_RATES } from '@weasel-js/clock';
import { multiplier, qty } from '@weasel-js/quantity';
import { DetentSlider } from '../DetentSlider';
import { QuantityText } from '../QuantityText';
import { Slider } from '../Slider';
import s from './Timeline.module.css';
import t from './Transport.module.css';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';

const RATE = multiplier({ symbol: 'x' });

/** Playback rates the transport offers by default, slowest first. */
export const TRANSPORT_RATES = CLOCK_RATES;

/** Props for {@link Transport}. Times are in ms. */
export interface TransportProps {
  paused: boolean;
  /** A `TimelineHandle`'s loop policy. The switch shows any value but
   *  `false` or `0` as on, and toggles between `true` and `false`. */
  loop: boolean | number;
  /** Playback speed multiplier. A rate off the offered detents gets one of its own. */
  rate: number;
  /** The rates offered, slowest first. Default `TRANSPORT_RATES`. */
  rates?: readonly number[];
  /** How a rate reads, shown and spoken. Default a multiplier, `0.5x`. */
  formatRate?: (rate: number) => string;
  playhead: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onLoopChange: (loop: boolean | number) => void;
  onRateChange: (rate: number) => void;
  /** Moves the playhead, in ms, as the scrub bar is dragged or stepped from
   *  the keyboard. Omitted, there is no scrub bar. */
  onSeek?: (playhead: number) => void;
  /** Whether playback runs backward. */
  reverse?: boolean;
  /** Flips the direction. Omitted, there is no reverse switch. */
  onReverseChange?: (reverse: boolean) => void;
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;
const spokenSeconds = (ms: number): string => `${(ms / 1000).toFixed(2)} seconds`;
const multiplierText = (r: number): string => qty(r, RATE).text;
const multiplierSpoken = (r: number): string => qty(r, RATE).spoken;

/** The playhead over the duration, in seconds, in a cell that holds its width. */
export function PlayheadReadout({ playhead, duration }: { playhead: number; duration: number }): ReactElement {
  const shown = Math.min(Math.max(playhead, 0), duration);
  return (
    <span className={s.time}>
      <span data-testid="timeline-time">
        {seconds(shown)} / {seconds(duration)}
      </span>
      <span className={s.sizer} aria-hidden="true">
        <span>{seconds(duration)} / {seconds(duration)}</span>
      </span>
    </span>
  );
}

/** Play/pause, a reverse switch, a loop switch, a rate slider, a scrub bar,
 *  and the playhead over the duration in seconds. Holds no state: every
 *  control reports through a callback, and the reverse switch and scrub bar
 *  appear only with theirs. It reads left to right in a right-to-left
 *  locale too, as playback controls do. */
export function Transport(props: TransportProps): ReactElement {
  const { paused, loop, rate, playhead, duration, onPlay, onPause, onLoopChange, onRateChange, onSeek, onReverseChange } = props;
  const reverse = props.reverse ?? false;
  const shown = Math.min(Math.max(playhead, 0), duration);
  const looping = loop !== false && loop !== 0;
  // The handle's scale is whatever anything holding it set, so an off-list rate
  // gets its own detent — `DetentSlider` would otherwise round it to the
  // nearest and label the thumb with a rate the timeline is not running at.
  const offered: readonly number[] = props.rates ?? TRANSPORT_RATES;
  const rateText = props.formatRate ?? multiplierText;
  const rateSpoken = props.formatRate ?? multiplierSpoken;
  const rateDrawn = (r: number) => (props.formatRate ? props.formatRate(r) : <QuantityText value={r} display={RATE} mute />);
  const rates = offered.includes(rate) ? offered : [...offered, rate].sort((a, b) => a - b);

  return (
    <div className={s.transport} dir="ltr">
      <button
        type="button"
        className={s.transportButton}
        aria-label={paused ? 'Play' : 'Pause'}
        onClick={paused ? onPlay : onPause}
      >
        {paused ? <Icon name={icon('play')} size={16} /> : <Icon name={icon('pause')} size={16} />}
      </button>

      {onReverseChange ? (
        <button
          type="button"
          role="switch"
          aria-checked={reverse}
          aria-label="Reverse"
          className={s.transportButton}
          onClick={() => onReverseChange(!reverse)}
        >
          <Icon name={icon('play')} size={16} className={t.backward} />
        </button>
      ) : null}

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
          items={rates.map((r) => ({ value: r, ariaLabel: rateSpoken(r) }))}
          value={rate}
          onChange={onRateChange}
          formatLabel={rateText}
          labels="none"
          className={s.rateSlider}
        />
        <span className={s.rateReadout}>
          <span>{rateDrawn(rate)}</span>
          <span className={s.sizer} aria-hidden="true">
            {rates.map((r) => <span key={r}>{rateDrawn(r)}</span>)}
          </span>
        </span>
      </div>

      {onSeek ? (
        <Slider
          ariaLabel="Position"
          thumbs={[{ value: shown, valueText: spokenSeconds(shown) }]}
          min={0}
          max={duration}
          onInput={([thumb]) => onSeek(thumb.value)}
          thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"
          className={t.scrub}
        />
      ) : null}

      <PlayheadReadout playhead={playhead} duration={duration} />
    </div>
  );
}
