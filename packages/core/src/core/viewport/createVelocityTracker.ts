interface Sample { dx: number; dy: number; t: number }

/** Records recent deltas and reports the current velocity, averaged over the
 *  last 100ms — the throw speed a momentum decay starts from. */
export interface VelocityTracker {
  record(dx: number, dy: number, t: number): void;
  /** The velocity over the 100ms before `now`, which defaults to the last
   *  sample's time. Pass the release's time, so a pointer that came to rest
   *  before it was let go reports none. */
  getVelocity(now?: number): { vx: number; vy: number };
  reset(): void;
}

/** Hook-free velocity tracker. `useVelocityTracker` wraps one of these; the
 *  action layer builds its own, because an Action descriptor is a static
 *  object and cannot call hooks. */
export function createVelocityTracker(): VelocityTracker {
  // The samples within 100ms of the last, after the latest one older than that: the start of the
  // delta the first of them carries.
  let samples: Sample[] = [];
  return {
    record(dx, dy, t) {
      samples.push({ dx, dy, t });
      const first = samples.findIndex((s) => s.t >= t - 100);
      samples = samples.slice(Math.max(0, first - 1));
    },
    getVelocity(now) {
      const last = samples[samples.length - 1];
      if (!last) return { vx: 0, vy: 0 };
      const cutoff = (now ?? last.t) - 100;
      const first = samples.findIndex((p) => p.t >= cutoff);
      if (first === -1) return { vx: 0, vy: 0 };
      // Two samples or more in the window measure from the first; a lone one, from the sample before it.
      const from = samples.length - first >= 2 ? first : first - 1;
      if (from < 0) return { vx: 0, vy: 0 };
      const s = samples.slice(from);
      // Up to `now`, not the last sample: a pointer at rest fires no moves, so its pause has no sample.
      const end = Math.max(now ?? -Infinity, last.t);
      const dt = end - s[0].t;
      if (dt === 0) return { vx: 0, vy: 0 };
      const totalDx = s.slice(1).reduce((acc, p) => acc + p.dx, 0);
      const totalDy = s.slice(1).reduce((acc, p) => acc + p.dy, 0);
      return { vx: totalDx / dt, vy: totalDy / dt };
    },
    reset() { samples = []; },
  };
}
