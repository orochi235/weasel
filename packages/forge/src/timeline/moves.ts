import type { Clock, ClockHandle } from '@weasel-js/clock';
import { clockSpecOf } from './clockSpec';
import type { SpanOverride, TimelineSpec } from './types';

const overrides = new WeakMap<ClockHandle, SpanOverride>();

/** Declares `handle` from the story's own spec, with the span `setSpan` last laid over it still in place. */
export function redeclare(handle: ClockHandle, declared: TimelineSpec): void {
  handle.declare(clockSpecOf({ ...declared, ...overrides.get(handle) }));
}

/** Lays `override` over the declared span of `handle`'s story, or lifts it for null. The shown time is kept. */
export function overrideSpan(handle: ClockHandle, declared: TimelineSpec, override: SpanOverride | null): void {
  if (override) overrides.set(handle, override);
  else overrides.delete(handle);
  redeclare(handle, declared);
}

/** Loops the clock without end, or plays it once. */
export function setLoop(clock: Clock, loop: boolean): void {
  clock.loop = loop;
}

/** Play, pause and speed, as `useTimeline` asks for them. */
export interface PlayMoves {
  /** Unsigned: what a pause comes back to. */
  speed(): number;
  play(): void;
  pause(): void;
  setSpeed(speed: number): void;
}

const speeds = new WeakMap<Clock, number>();

/** The moves on a clock no transport works, as outside a lab: the speed a pause returns to is kept here. */
export function ownMoves(clock: Clock): PlayMoves {
  const speed = (): number => speeds.get(clock) ?? (Math.abs(clock.rate) || clock.speed);
  return {
    speed,
    play() {
      if (clock.rate !== 0) return;
      // Playing from the end starts over, as a player's play button does.
      if (clock.ended) clock.seek(0);
      clock.rate = speed();
    },
    pause() {
      clock.rate = 0;
    },
    setSpeed(next) {
      speeds.set(clock, next);
      if (clock.rate !== 0) clock.rate = next;
    },
  };
}
