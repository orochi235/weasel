import type { View } from '../../core/viewport/view';

export type ScalarOrXY = number | { x: number; y: number };

export interface ParallaxOpts {
  pan: ScalarOrXY;
  zoom?: ScalarOrXY;
  anchor?: { x: number; y: number };
}

function asXY(v: ScalarOrXY): { x: number; y: number } {
  return typeof v === 'number' ? { x: v, y: v } : v;
}

/**
 * Pure derivation of a parallax plane's inner `View` from the camera view
 * plus per-plane factors.
 *
 * `pan` controls how much the plane translates with the camera (1 = normal,
 * 0 = locked to `anchor`, >1 = leads). `zoom` controls how much it scales
 * with camera zoom (1 = normal, 0 = fixed at identity scale). `anchor`
 * (default origin) is the world point all planes agree on.
 *
 * Identity holds: `pan=1, zoom=1` returns a view equal to `outer`.
 */
export function deriveParallaxView(outer: View, opts: ParallaxOpts): View {
  const p = asXY(opts.pan);
  const z = asXY(opts.zoom ?? 1);
  const a = opts.anchor ?? { x: 0, y: 0 };
  return {
    x: a.x + (outer.x - a.x) * p.x,
    y: a.y + (outer.y - a.y) * p.y,
    scale: {
      x: 1 + (outer.scale.x - 1) * z.x,
      y: 1 + (outer.scale.y - 1) * z.y,
    },
  };
}
