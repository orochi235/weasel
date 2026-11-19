import { wrapPositive } from '@weasel-js/geom';
const finite = (t: number): number => {
  if (!Number.isFinite(t)) throw new RangeError(`a timeline seeks to a finite time, not ${t}`);
  return t;
};

/** The laps a loop policy allows past the pass it starts on: a count is passes, as a clock's is. */
const lapsOf = (loop: boolean | number): number => (loop === true ? Infinity : loop === false ? 0 : Math.max(1, loop) - 1);

/** `t` less `laps` laps of `duration`. Where the laps alone pass the double range, near
 *  `Number.MAX_VALUE`, where the animator's clock stops, that is where `t` stands in its lap. */
function lessLaps(t: number, laps: number, duration: number): number {
  // No laps of an endless duration are none, not `NaN`.
  if (laps === 0) return t;
  const span = laps * duration;
  return Number.isFinite(span) ? t - span : wrapPositive(t, duration);
}

/** The playhead and its offset from the entry's clock, which stands at `now`, `laps` laps back.
 *  Where the offset would pass the double range, the playhead is where it stands in its lap. */
function lapBack(playhead: number, offset: number, now: number, laps: number, duration: number): [number, number] {
  const span = laps * duration;
  const kept = offset - span;
  if (Number.isFinite(span) && Number.isFinite(kept)) return [playhead - span, kept];
  const next = wrapPositive(playhead, duration);
  return [next, next - now];
}

/** Where a seek lands: at root time `at`, `laps` laps on from the lap it was asked in. */
export interface Landing { at: number; laps: number }

/** Where a seek to `t` lands: not before 0, nor past `duration` unless laps are left, where it
 *  lands in a later lap, `laps` on, and a time on a seam is the end of the lap before. */
export function landing(t: number, duration: number, lapsLeft: number): Landing {
  const to = Math.max(0, finite(t));
  const laps = duration > 0 && to > duration ? Math.min(Math.ceil(to / duration) - 1, lapsLeft) : 0;
  return { at: Math.min(lessLaps(to, laps, duration), duration), laps };
}

/** The laps a playhead at or past `duration` has crossed, of those left, all at once: a frame that
 *  skips whole laps fires the outgoing lap's tail and the lap it lands in, and nothing of the laps
 *  in between. Played backward below 0, the laps crossed back into, of the `lap` behind it, as a
 *  count below 0. */
function lapsCrossed(playhead: number, duration: number, loopsLeft: number, lap: number): number {
  if (duration <= 0) return 0;
  return playhead >= duration ? Math.min(Math.floor(playhead / duration), loopsLeft)
    : playhead < 0 ? -Math.min(Math.ceil(-playhead / duration), lap) : 0;
}

/** A timeline's position: where its playhead stands against the animator entry's clock, and the
 *  laps it has taken and has left. */
export interface Playhead {
  time(): number;
  duration(): number;
  setDuration(duration: number): void;
  /** Laps taken since creation. Never reset, so a (lap, root time) pair names one crossing for good. */
  lap(): number;
  /** Laps still allowed after the current one; `Infinity` when endless. */
  lapsLeft(): number;
  loop(): boolean | number;
  setLoop(loop: boolean | number): void;
  /** Whether it stands on a seam with laps left: where a seek to the end of a lap leaves it. */
  onSeam(): boolean;
  /** Whether it stands at the end it plays toward: going forward its end, and played backward
   *  the start of its first lap, as one exactly on a later lap's start goes on into the lap behind. */
  atEnd(backward: boolean): boolean;
  /** Follows the entry's clock to `virtualNow`, taking any laps that crosses and handing their count to `wrapped`. */
  advance(virtualNow: number, wrapped: (laps: number) => void): void;
  /** Holds it within `[0, duration]`. */
  clamp(): void;
  /** Puts it where a seek landed, against the entry's clock at `virtualNow`. */
  place(landed: Landing, virtualNow: number): void;
  /** Keeps it where it stands across the entry's clock restarting at 0. */
  rebase(): void;
}

export function createPlayhead(duration: number, loop: boolean | number): Playhead {
  let t = 0;
  let offset = 0;
  let lap = 0;
  let loopsLeft = lapsOf(loop);
  const take = (laps: number): void => { loopsLeft -= laps; lap += laps; };

  return {
    time: () => t,
    duration: () => duration,
    setDuration(d) { duration = d; },
    lap: () => lap,
    lapsLeft: () => loopsLeft,
    loop: () => (loopsLeft === Infinity ? true : loopsLeft === 0 ? false : loopsLeft + 1),
    setLoop(next) { loopsLeft = lapsOf(next); },
    onSeam: () => duration > 0 && t === duration && loopsLeft > 0,
    atEnd: (backward) => (backward ? t <= 0 && lap === 0 : t >= duration),
    advance(virtualNow, wrapped) {
      t = virtualNow + offset;
      const laps = lapsCrossed(t, duration, loopsLeft, lap);
      if (laps === 0) return;
      take(laps);
      [t, offset] = lapBack(t, offset, virtualNow, laps, duration);
      wrapped(laps);
    },
    clamp() { t = Math.min(Math.max(t, 0), duration); },
    place(landed, virtualNow) {
      offset = landed.at - virtualNow;
      t = landed.at;
      if (landed.laps > 0) take(landed.laps);
    },
    rebase() { offset = t; },
  };
}
