/** A clock read further than this from the frame clock's prediction is taken
 *  as a discontinuity — a hidden tab, a suspended context — not as jitter. */
const RESYNC_MS = 50;
/** Share of each frame's clock residual folded into the estimate. Small enough
 *  to average out a per-frame read that lands a render quantum early or late;
 *  large enough to follow ppm-scale drift with well under a millisecond of lag. */
const SLEW = 0.05;

/** The booking clock's time at the current frame, smoothed, as the timeline's virtual clock
 *  advances at the frame's scale. */
export interface ClockEstimate {
  /** At a playing frame: follows the clock, read at `now`, to virtual time `virtualNow`. Answers
   *  whether the mapping between the two moved — the scale changed, or the clock jumped — so
   *  bookings made under the old one may stand at the wrong time. */
  follow(now: number, virtualNow: number, scale: number): boolean;
  /** At a held frame: drops the estimate. Answers whether playback was running until now. */
  halt(): boolean;
  /** Drops the estimate, to anchor afresh at the next frame. */
  rearm(): void;
  /** The clock time root time `u` falls at, with the playhead at `playhead`; not before `now`. */
  whenFor(u: number, playhead: number, scale: number, now: number): number;
}

export function createClockEstimate(): ClockEstimate {
  /** Null until anchored. */
  let est: number | null = null;
  let mapVirtual = 0;
  let lastScale = 0;

  return {
    follow(now, virtualNow, scale) {
      let moved = lastScale > 0 && scale !== lastScale;
      if (est === null) {
        est = now;
      } else {
        est += (virtualNow - mapVirtual) / scale;
        const residual = now - est;
        if (Math.abs(residual) > RESYNC_MS) {
          est = now;
          moved = true;
        } else {
          est += residual * SLEW;
        }
      }
      mapVirtual = virtualNow;
      lastScale = scale;
      return moved;
    },
    halt() {
      const was = lastScale > 0;
      lastScale = 0;
      est = null;
      return was;
    },
    rearm() { est = null; },
    whenFor: (u, playhead, scale, now) => Math.max(est! + (u - playhead) / scale, now),
  };
}
