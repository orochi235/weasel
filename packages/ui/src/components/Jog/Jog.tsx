import type { ReactNode } from 'react';
import type { TrackShape } from '@weasel-js/geom';
import type { ControlAccess } from '@weasel-js/ui-logic';
import { RunScope, useRun } from '../Run';
import { Button } from '../Button';
import { useControlAccess, type HoldProps } from '../Disabled';
import { heldState, ownHold } from '../Disabled/controlHold';
import { Slider } from '../Slider/Slider';
import { JogAlong } from './JogAlong';
import s from './Jog.module.css';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';

/** Props for {@link Jog}. Disabled or read-only, it neither plays, steps, nor scrubs: the step showing is its value. */
export interface JogProps extends HoldProps {
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
 * Inside a curved `Along`, its buttons, readout and caption lie along the shape and the scrubber
 * follows it between them.
 *
 * It reads left to right in a right-to-left locale too, as playback controls do; its caption takes its own text's
 * direction.
 *
 * Named for the jog of jog/shuttle — moving one frame at a time, as against running at speed.
 */
export function Jog(props: JogProps) {
  const { shape, align } = useRun();
  const access = useControlAccess(props);
  const parts = jogParts(props, access);
  if (shape !== undefined && shape.kind !== 'line')
    return <JogAlong parts={parts} shape={shape} align={align ?? 'center'} className={props.className} held={heldState(access)} />;

  return (
    <div className={[s.jog, props.className].filter(Boolean).join(' ')} dir="ltr" data-held={heldState(access)}>
      {parts.prev}
      {parts.play}
      {parts.next}
      {parts.scrub?.()}
      {parts.readout}
      {parts.caption}
    </div>
  );
}

function jogParts(props: JogProps, access: ControlAccess): JogParts {
  const { index, count, playing, onPlay, onStep, onScrub, unit = 'Step', caption } = props;
  // Its buttons are actions, which a read-only scope passes over, so the Jog holds them itself, for its reason.
  const held = access.state !== 'enabled';
  const reason = access.reason;

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
        aria-label={`Previous ${unit.toLowerCase()}`}
        disabled={held || at <= 0}
        disabledReason={held ? reason : undefined}
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
        aria-label={playing ? 'Pause' : 'Play'}
        disabled={held || count < 2}
        disabledReason={held ? reason : undefined}
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
        aria-label={`Next ${unit.toLowerCase()}`}
        disabled={held || at >= last}
        disabledReason={held ? reason : undefined}
        onClick={() => onStep(1)}
      >
        <Icon name={icon('stepForward')} size={16} />
      </Button>
    ),
    scrub:
      onScrub && count > 0
        ? (shape) => (
            // Only the shape it is handed: on a straight row an enclosing `Along` must not bend it.
            <RunScope fresh shape={shape} align={shape ? 'center' : undefined}>
              <Slider
                className={s.scrub}
                min={0}
                max={last}
                step={1}
                snap="strict"
                thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"
                aria-label={unit}
                {...ownHold(props)}
                thumbs={[{ value: at, valueText: spoken }]}
                onInput={(next) => onScrub(Math.round(next[0]?.value ?? 0))}
              />
            </RunScope>
          )
        : null,
    readout: (
      <span className={s.readout} data-testid="jog-readout">
        {pad(ordinal, count)}/{count}
      </span>
    ),
    caption: caption ? <span className={s.caption} dir="auto">{caption}</span> : null,
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
