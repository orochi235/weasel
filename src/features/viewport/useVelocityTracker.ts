import { useMemo, useRef } from 'react';

interface Sample { dx: number; dy: number; t: number }

export function useVelocityTracker() {
  const samplesRef = useRef<Sample[]>([]);
  return useMemo(() => ({
    record(dx: number, dy: number, t: number) {
      samplesRef.current.push({ dx, dy, t });
      const cutoff = t - 100;
      samplesRef.current = samplesRef.current.filter(s => s.t >= cutoff);
    },
    getVelocity(): { vx: number; vy: number } {
      const s = samplesRef.current;
      if (s.length < 2) return { vx: 0, vy: 0 };
      const dt = s[s.length - 1].t - s[0].t;
      if (dt === 0) return { vx: 0, vy: 0 };
      const totalDx = s.slice(1).reduce((acc, p) => acc + p.dx, 0);
      const totalDy = s.slice(1).reduce((acc, p) => acc + p.dy, 0);
      return { vx: totalDx / dt, vy: totalDy / dt };
    },
    reset() { samplesRef.current = []; },
  }), []);
}
