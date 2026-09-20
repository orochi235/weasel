import type { ReactNode } from 'react';
import { PauseIcon, PlayIcon, StepBackIcon, StepForwardIcon } from '../../icons';
import { Button } from '../Button';
import { Slider } from '../Slider/Slider';
import s from './Jog.module.css';

/** Props for {@link Jog}. */
export interface JogProps {
  /** Which step is showing, 0-based. */
  index: number;
  /** How many steps there are. */
  count: number;
  playing: boolean;
  onPlay: (playing: boolean) => void;
  /** Move one step, back or forward. */
  onStep: (by: -1 | 1) => void;
  /** Jump to a step. Left out, no scrubber is drawn. */
  onScrub?: (index: number) => void;
  /** What one step is called, for the spoken labels. Defaults to `Step`. */
  unit?: string;
  /** Drawn after the readout — a beat's caption, a snapshot's date. */
  caption?: ReactNode;
  className?: string;
}

/**
 * Transport for something counted rather than timed: beat 3 of 24, not 4.20s of 12.00s.
 * `<Transport>` is the continuous-time one, and wants a playhead in milliseconds, a rate and
 * a loop, none of which a list of steps has.
 *
 * Named for the jog of jog/shuttle — moving one frame at a time, as against running at speed.
 */
export function Jog(props: JogProps) {
  const { index, count, playing, onPlay, onStep, onScrub, unit = 'Step', caption, className } =
    props;

  const last = Math.max(0, count - 1);
  const at = Math.min(Math.max(index, 0), last);
  const spoken = `${unit} ${at + 1} of ${count}`;

  return (
    <div className={[s.jog, className].filter(Boolean).join(' ')}>
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        ariaLabel={`Previous ${unit.toLowerCase()}`}
        disabled={at <= 0}
        onClick={() => onStep(-1)}
      >
        <StepBackIcon size={14} />
      </Button>
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        ariaLabel={playing ? 'Pause' : 'Play'}
        disabled={count < 2}
        onClick={() => onPlay(!playing)}
      >
        {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
      </Button>
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        ariaLabel={`Next ${unit.toLowerCase()}`}
        disabled={at >= last}
        onClick={() => onStep(1)}
      >
        <StepForwardIcon size={14} />
      </Button>

      {onScrub && (
        <Slider
          className={s.scrub}
          min={0}
          max={last}
          step={1}
          snap="strict"
          density="slim"
          ariaLabel={unit}
          thumbs={[{ value: at, valueText: spoken }]}
          onInput={(next) => onScrub(Math.round(next[0]?.value ?? 0))}
        />
      )}

      <span className={s.readout} data-testid="jog-readout">
        {pad(at + 1, count)}/{count}
      </span>
      {caption ? <span className={s.caption}>{caption}</span> : null}
    </div>
  );
}

/**
 * Figure spaces, not regular ones: the readout updates every beat, and a run from 9 to 10 that
 * widens by a digit shoves whatever follows it along the row. `tabular-nums` fixes the width of
 * a digit and not how many there are, so the padding is what holds the row still.
 */
function pad(value: number, count: number): string {
  return String(value).padStart(String(count).length, ' ');
}
