import type { ReactNode } from 'react';
import type { TrackShape } from '@weasel-js/geom';
import { AlongContext, useTrackShape, type RunAlign } from '../Along/alongContext';
import { Button } from '../Button';
import { Slider } from '../Slider/Slider';
import { JogAlong } from './JogAlong';
import s from './Jog.module.css';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';

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
  /** A curved shape to lay the controls along. Default: the nearest `Along`'s, else a straight row. */
  shape?: TrackShape;
  /** Where the controls sit on a curve too long for them, when there is no scrubber to fill it. Default: the `Along`'s,
   *  else `'center'`. */
  align?: RunAlign;
  className?: string;
}

/** A Jog's controls, each drawn once and laid out by whichever layout holds them. */
export interface JogParts {
  prev: ReactNode;
  play: ReactNode;
  next: ReactNode;
  /** The scrubber along `shape`, or straight without one; null when there is nothing to scrub. */
  scrub: ((shape?: TrackShape) => ReactNode) | null;
  readout: ReactNode;
  caption: ReactNode;
}

/**
 * Transport for something counted rather than timed: beat 3 of 24, not 4.20s of 12.00s.
 * `<Transport>` is the continuous-time one, and wants a playhead in milliseconds, a rate and
 * a loop, none of which a list of steps has.
 *
 * Inside an `Along`, or given a curved `shape`, its buttons, readout and caption lie along the shape and the scrubber
 * follows it between them.
 *
 * Named for the jog of jog/shuttle — moving one frame at a time, as against running at speed.
 */
export function Jog(props: JogProps) {
  const along = useTrackShape();
  const shape = props.shape ?? along?.shape;
  const parts = jogParts(props);
  if (shape !== undefined && shape.kind !== 'line')
    return <JogAlong parts={parts} shape={shape} align={props.align ?? along?.align ?? 'center'} className={props.className} />;

  return (
    <div className={[s.jog, props.className].filter(Boolean).join(' ')}>
      {parts.prev}
      {parts.play}
      {parts.next}
      {parts.scrub?.()}
      {parts.readout}
      {parts.caption}
    </div>
  );
}

function jogParts(props: JogProps): JogParts {
  const { index, count, playing, onPlay, onStep, onScrub, unit = 'Step', caption } = props;

  const last = Math.max(0, count - 1);
  const at = Math.min(Math.max(index, 0), last);
  const ordinal = count > 0 ? at + 1 : 0;
  const spoken = `${unit} ${ordinal} of ${count}`;

  return {
    prev: (
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        ariaLabel={`Previous ${unit.toLowerCase()}`}
        disabled={at <= 0}
        onClick={() => onStep(-1)}
      >
        <Icon name={icon('stepBack')} size={16} />
      </Button>
    ),
    play: (
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        ariaLabel={playing ? 'Pause' : 'Play'}
        disabled={count < 2}
        onClick={() => onPlay(!playing)}
      >
        {playing ? <Icon name={icon('pause')} size={16} /> : <Icon name={icon('play')} size={16} />}
      </Button>
    ),
    next: (
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        ariaLabel={`Next ${unit.toLowerCase()}`}
        disabled={at >= last}
        onClick={() => onStep(1)}
      >
        <Icon name={icon('stepForward')} size={16} />
      </Button>
    ),
    scrub:
      onScrub && count > 0
        ? (shape) => (
            // Only the shape it is handed: on a straight row an enclosing `Along` must not bend it.
            <AlongContext.Provider value={null}>
              <Slider
                className={s.scrub}
                shape={shape}
                min={0}
                max={last}
                step={1}
                snap="strict"
                density="slim"
                ariaLabel={unit}
                thumbs={[{ value: at, valueText: spoken }]}
                onInput={(next) => onScrub(Math.round(next[0]?.value ?? 0))}
              />
            </AlongContext.Provider>
          )
        : null,
    readout: (
      <span className={s.readout} data-testid="jog-readout">
        {pad(ordinal, count)}/{count}
      </span>
    ),
    caption: caption ? <span className={s.caption}>{caption}</span> : null,
  };
}

/**
 * Figure spaces, not regular ones: the readout updates every beat, and a run from 9 to 10 that
 * widens by a digit shoves whatever follows it along the row. `tabular-nums` fixes the width of
 * a digit and not how many there are, so the padding is what holds the row still.
 */
function pad(value: number, count: number): string {
  return String(value).padStart(String(count).length, '\u2007');
}
