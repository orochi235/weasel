import type { TrialClock } from './trialClock';

/**
 * What a transport does to a trial clock. The clock holds one signed rate,
 * and `0` is paused, so the speed and direction a pause must come back to are
 * held here.
 */
export interface TransportControl {
  readonly playing: boolean;
  /** Unsigned, one of the clock's `rates` or whatever it opened at. */
  readonly speed: number;
  readonly backward: boolean;
  /** Whether anyone has worked the clock from a transport. */
  readonly touched: boolean;
  /** The shown time the current pass starts at: the clock's `origin`. */
  readonly start: number;
  /** The shown time, ms: `origin` plus the time within the current pass. */
  readonly playhead: number;
  /** ms per pass; for a run with no end, the time played so far. */
  readonly length: number;
  /** Whether the playhead can be moved and the direction flipped. */
  readonly scrubs: boolean;
  /** Mark the clock as worked by hand, for a change made outside these actions. */
  touch(): void;
  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(speed: number): void;
  /** One offered rate faster (`1`) or slower (`-1`). */
  stepSpeed(direction: 1 | -1): void;
  setBackward(backward: boolean): void;
  /** Move to shown time `ms`, within the current pass. */
  seek(ms: number): void;
}

/** The control over `clock`, given the speed and direction it last ran at
 *  and where to keep a change to either. */
export function transportControl(
  clock: TrialClock,
  held: { speed: number; backward: boolean; touched?: boolean },
  hold: (next: { speed: number; backward: boolean }) => void,
  touch: () => void = () => {},
): TransportControl {
  const finite = Number.isFinite(clock.duration) && clock.duration > 0;
  const passStart = finite ? clock.pass * clock.duration : 0;
  const scrubs = clock.seekable && finite;
  const signed = (speed: number, backward: boolean): number =>
    backward && clock.seekable ? -speed : speed;
  const playing = clock.rate !== 0;
  const control: TransportControl = {
    playing,
    speed: held.speed,
    backward: held.backward,
    touched: held.touched ?? false,
    start: clock.origin,
    playhead: clock.origin + (finite ? clock.phase * clock.duration : clock.elapsed),
    length: finite ? clock.duration : clock.elapsed,
    scrubs,
    touch,
    play() {
      // A run played to the end starts over, the way a player's play does.
      if (clock.seekable && !held.backward && clock.ended) clock.seek(0);
      clock.rate = signed(held.speed, held.backward);
    },
    pause() {
      clock.rate = 0;
    },
    toggle() {
      if (playing) control.pause();
      else control.play();
    },
    setSpeed(speed) {
      hold({ ...held, speed });
      if (playing) clock.rate = signed(speed, held.backward);
    },
    stepSpeed(direction) {
      const rates = clock.rates;
      const next =
        direction > 0
          ? rates.find((r) => r > held.speed)
          : [...rates].reverse().find((r) => r < held.speed);
      if (next !== undefined) control.setSpeed(next);
    },
    setBackward(backward) {
      if (!clock.seekable) return;
      hold({ ...held, backward });
      if (playing) clock.rate = signed(held.speed, backward);
    },
    seek(ms) {
      if (!scrubs) return;
      const within = ms - clock.origin;
      if (within >= clock.duration) clock.seek((clock.pass + 1) * clock.duration, 'end');
      else clock.seek(passStart + Math.max(within, 0));
    },
  };
  return control;
}
