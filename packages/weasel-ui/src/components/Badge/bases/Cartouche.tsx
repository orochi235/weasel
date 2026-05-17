import type { BaseModule } from './types';
import { polygonSampler } from './polygonSampler';

export interface CartoucheBaseParams {
  /** X-position where the brace meets the main body, in viewBox units (0..50). */
  bodyEdge?: number;
  /** X-position of the outermost arm tip (smaller = further outward). */
  armTipX?: number;
  /** X-position of the inward pinch (larger = deeper inward into the body). */
  pinchX?: number;
  /** Vertical position of the upper arm tip (mirrored for lower). */
  armTipY?: number;
  /** Sample count per quadratic bezier segment (4 segments per side). */
  samples?: number;
}

const DEFAULTS: Required<CartoucheBaseParams> = {
  bodyEdge: 22,
  armTipX: 6,
  pinchX: 16,
  armTipY: 18,
  samples: 14,
};

function quad(p0: [number, number], p1: [number, number], p2: [number, number], N: number, includeEnd: boolean): [number, number][] {
  const out: [number, number][] = [];
  const last = includeEnd ? N : N - 1;
  for (let i = 0; i <= last; i++) {
    const t = i / N;
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    out.push([x, y]);
  }
  return out;
}

export function cartoucheVertices(params: CartoucheBaseParams = {}): [number, number][] {
  const cfg = { ...DEFAULTS, ...params };
  const be = Math.max(8, Math.min(cfg.bodyEdge, 45));
  const ax = Math.max(0, Math.min(cfg.armTipX, be - 2));
  const px = Math.max(ax + 1, Math.min(cfg.pinchX, be - 1));
  const ay = Math.max(4, Math.min(cfg.armTipY, 45));
  const N = Math.max(3, Math.floor(cfg.samples));
  const left: [number, number][] = [];
  left.push(...quad([be, 0], [ax, 0], [ax, ay], N, false));
  left.push(...quad([ax, ay], [px, ay], [px, 50], N, false));
  left.push(...quad([px, 50], [px, 100 - ay], [ax, 100 - ay], N, false));
  left.push(...quad([ax, 100 - ay], [ax, 100], [be, 100], N, true));
  const right: [number, number][] = [];
  right.push(...quad([100 - be, 100], [100 - ax, 100], [100 - ax, 100 - ay], N, false));
  right.push(...quad([100 - ax, 100 - ay], [100 - px, 100 - ay], [100 - px, 50], N, false));
  right.push(...quad([100 - px, 50], [100 - px, ay], [100 - ax, ay], N, false));
  right.push(...quad([100 - ax, ay], [100 - ax, 0], [100 - be, 0], N, true));
  return [...left, ...right];
}

const Cartouche: BaseModule<CartoucheBaseParams> = {
  build: (params, boxW, boxH) => polygonSampler(cartoucheVertices(params), boxW, boxH),
  defaults: DEFAULTS,
  insets: { top: 4, right: 14, bottom: 4, left: 14 },
};

export default Cartouche;
