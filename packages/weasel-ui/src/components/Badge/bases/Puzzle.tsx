import type { BaseModule } from './types';
import { polygonSampler } from './polygonSampler';

export type PuzzleEdge = 'flat' | 'out' | 'in';

export interface PuzzleParams {
  top?: PuzzleEdge;
  right?: PuzzleEdge;
  bottom?: PuzzleEdge;
  left?: PuzzleEdge;
  /** Tab radius in viewBox units (0..50). */
  tabSize?: number;
  /** Sample density per tab arc. */
  arcSamples?: number;
}

const DEFAULTS: Required<PuzzleParams> = {
  top: 'out',
  right: 'in',
  bottom: 'out',
  left: 'in',
  tabSize: 12,
  arcSamples: 18,
};

// Fraction of the tab radius the tab center sits beyond the body edge. A center offset of
// `OFFSET_RATIO * r` gives a tab whose chord (intersection with the edge) has half-length
// √(1 − OFFSET_RATIO²) · r. Smaller offset → wider neck.
const OFFSET_RATIO = 0.62;

/** Sample a side's vertices walking clockwise from `start` to `end` along the edge, possibly
 *  detouring around a tab. The starting vertex `start` is NOT included; the ending vertex `end`
 *  IS included so successive edge calls chain cleanly. */
function edgeVertices(
  start: [number, number],
  end: [number, number],
  outwardX: number,
  outwardY: number,
  type: PuzzleEdge,
  tabR: number,
  arcSamples: number,
): [number, number][] {
  if (type === 'flat') return [end];
  const sign = type === 'out' ? 1 : -1;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  const mx = (start[0] + end[0]) / 2;
  const my = (start[1] + end[1]) / 2;
  const cx = mx + outwardX * sign * tabR * OFFSET_RATIO;
  const cy = my + outwardY * sign * tabR * OFFSET_RATIO;
  const half = tabR * Math.sqrt(Math.max(0, 1 - OFFSET_RATIO * OFFSET_RATIO));
  const p1: [number, number] = [mx - tx * half, my - ty * half];
  const p2: [number, number] = [mx + tx * half, my + ty * half];
  const apex: [number, number] = [
    mx + outwardX * sign * (tabR + tabR * (1 - OFFSET_RATIO)),
    my + outwardY * sign * (tabR + tabR * (1 - OFFSET_RATIO)),
  ];
  const r = Math.hypot(p1[0] - cx, p1[1] - cy);
  const θ1 = Math.atan2(p1[1] - cy, p1[0] - cx);
  const θ2 = Math.atan2(p2[1] - cy, p2[0] - cx);
  const θApex = Math.atan2(apex[1] - cy, apex[0] - cx);
  // Choose the arc direction that sweeps through θApex.
  const TAU = Math.PI * 2;
  const apexFromStart = ((θApex - θ1) % TAU + TAU) % TAU;
  const endFromStart = ((θ2 - θ1) % TAU + TAU) % TAU;
  // If the CCW sweep covers apex before reaching θ2, use CCW; otherwise CW.
  const sweep = apexFromStart < endFromStart ? endFromStart : endFromStart - TAU;

  const out: [number, number][] = [];
  out.push(p1);
  for (let i = 1; i <= arcSamples; i++) {
    const t = i / arcSamples;
    const θ = θ1 + sweep * t;
    out.push([cx + r * Math.cos(θ), cy + r * Math.sin(θ)]);
  }
  out.push(end);
  return out;
}

const Puzzle: BaseModule<PuzzleParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const r = Math.max(2, Math.min(cfg.tabSize, 40));
    const N = Math.max(6, Math.floor(cfg.arcSamples));
    // Clockwise traversal of the unit rect: TL → TR → BR → BL → TL.
    const TL: [number, number] = [0, 0];
    const TR: [number, number] = [100, 0];
    const BR: [number, number] = [100, 100];
    const BL: [number, number] = [0, 100];
    const verts: [number, number][] = [TL];
    verts.push(...edgeVertices(TL, TR,  0, -1, cfg.top,    r, N));
    verts.push(...edgeVertices(TR, BR,  1,  0, cfg.right,  r, N));
    verts.push(...edgeVertices(BR, BL,  0,  1, cfg.bottom, r, N));
    verts.push(...edgeVertices(BL, TL, -1,  0, cfg.left,   r, N));
    // Drop the trailing duplicate of TL.
    if (verts.length > 1 && verts[verts.length - 1][0] === TL[0] && verts[verts.length - 1][1] === TL[1]) {
      verts.pop();
    }
    return polygonSampler(verts, boxW, boxH);
  },
  defaults: DEFAULTS,
  insets: { top: 12, right: 16, bottom: 12, left: 16 },
};

export default Puzzle;
