import type { Clock } from '@weasel-js/clock';
import { createEmitter } from '@weasel-js/registry';

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
const speedChanged = createEmitter<[Clock]>();

/** Calls `listener` when the speed a pause of `clock` returns to changes outside a transport. */
export function subscribeSpeed(clock: Clock, listener: () => void): () => void {
  return speedChanged.subscribe((changed) => {
    if (changed === clock) listener();
  });
}

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
      else speedChanged.emit(clock);
    },
  };
}
