import type { Point } from '../paths/cubicMath';
import { DEG_TO_RAD, wrapPositive } from '../angle';
import { clamp } from '../scalar';
import type { TrackAtOptions, TrackShape, TrackStation } from './shape';

/** An arc track: degrees clockwise from 12 o'clock on a y-down plane. Equal `start` and `end` is a whole circle. */
export interface ArcTrackSpec {
  center: Point;
  radius: number;
  start: number;
  end: number;
  /** Which way the track runs from `start` to `end`. Default `'cw'`. */
  direction?: 'cw' | 'ccw';
}

/** A track shape that remembers the arc it was built from, so path data can be drawn as arcs. */
export type ArcTrackShape = TrackShape & { readonly arc: ArcTrackSpec };

/** An arc track; its normal points away from the center, whichever way it runs. */
export function arcShape(spec: ArcTrackSpec): ArcTrackShape {
  const { center, radius, start } = spec;
  const sign = spec.direction === 'ccw' ? -1 : 1;
  const raw = wrapPositive(sign * (spec.end - start), 360);
  const sweep = raw === 0 ? 360 : raw;
  const length = radius * sweep * DEG_TO_RAD;

  const at = (f: number, options?: TrackAtOptions): TrackStation => {
    const t = options?.open ? f : clamp(f, 0, 1);
    const theta = (start + sign * t * sweep) * DEG_TO_RAD;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    return {
      point: { x: center.x + radius * s, y: center.y - radius * c },
      tangent: { x: sign * c, y: sign * s },
      normal: { x: s, y: -c },
    };
  };

  const shape: TrackShape = {
    kind: 'arc',
    length,
    closed: raw === 0,
    at,
    nearest(p, options) {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const angle = dx === 0 && dy === 0 ? 0 : Math.atan2(dx, -dy) / DEG_TO_RAD;
      const offset = wrapPositive(sign * (angle - start), 360);
      let f: number;
      if (offset <= sweep) f = offset / sweep;
      else f = 360 - offset < offset - sweep ? 0 : 1;
      const q = at(f).point;
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      if (!options?.open) return { f, dist };
      const mid = (options.about ?? 0.5) * sweep;
      const unwrapped = mid + wrapPositive(offset - mid + 180, 360) - 180;
      return { f: unwrapped / sweep, dist };
    },
  };
  Object.defineProperty(shape, 'arc', { value: spec, enumerable: false });
  return shape as ArcTrackShape;
}
