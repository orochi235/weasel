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
  let samples: Sample[] = [];
  return {
    record(dx, dy, t) {
      samples.push({ dx, dy, t });
      const cutoff = t - 100;
      samples = samples.filter(s => s.t >= cutoff);
    },
    getVelocity(now) {
      const s = now === undefined ? samples : samples.filter((p) => p.t >= now - 100);
      if (s.length < 2) return { vx: 0, vy: 0 };
      const dt = s[s.length - 1].t - s[0].t;
      if (dt === 0) return { vx: 0, vy: 0 };
      const totalDx = s.slice(1).reduce((acc, p) => acc + p.dx, 0);
      const totalDy = s.slice(1).reduce((acc, p) => acc + p.dy, 0);
      return { vx: totalDx / dt, vy: totalDy / dt };
    },
    reset() { samples = []; },
  };
}
