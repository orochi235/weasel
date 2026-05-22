import { resolveEdge, type EdgeCap } from './edgeProfiles';
import type { BaseModule, BaseSampler, PerimeterPoint } from './types';

export interface PowerlineParams {
  /** Profile for the left edge (the cap segment N inherits from segment N-1). */
  leftEdge?: EdgeCap;
  /** Profile for the right edge (this segment's own end cap). */
  rightEdge?: EdgeCap;
  /** Protrusion depth in CSS px (positive values stick out beyond the rect). */
  depth?: number;
}

const DEFAULTS: Required<PowerlineParams> = {
  leftEdge: 'flat',
  rightEdge: 'flat',
  depth: 6,
};

// Samples per vertical edge. 64 is smooth enough for chevron/round caps and
// cheap to evaluate; the perimeter is sampled once per `build` call.
const EDGE_SAMPLES = 64;

const Powerline: BaseModule<PowerlineParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const left = resolveEdge(cfg.leftEdge);
    const right = resolveEdge(cfg.rightEdge);
    const depth = cfg.depth;
    const sx = 100 / boxW;
    const sy = 100 / boxH;

    const pts: { x: number; y: number; nx: number; ny: number }[] = [];

    // Top corners follow the same edge profiles as the rest of the verticals,
    // so a profile that protrudes/cuts at t=0 (e.g. slant-up) doesn't introduce
    // a corner kink between the flat top and the first vertical sample.
    pts.push({ x: left(0, depth) * sx, y: 0, nx: 0, ny: -1 });
    pts.push({ x: (boxW + right(0, depth)) * sx, y: 0, nx: 0, ny: -1 });

    for (let i = 1; i < EDGE_SAMPLES; i++) {
      const t = i / EDGE_SAMPLES;
      const xCss = boxW + right(t, depth);
      pts.push({ x: xCss * sx, y: t * 100, nx: 1, ny: 0 });
    }

    pts.push({ x: (boxW + right(1, depth)) * sx, y: 100, nx: 0, ny: 1 });
    pts.push({ x: (0 + left(1, depth)) * sx, y: 100, nx: 0, ny: 1 });

    for (let i = EDGE_SAMPLES - 1; i >= 1; i--) {
      const t = i / EDGE_SAMPLES;
      const xCss = 0 + left(t, depth);
      pts.push({ x: xCss * sx, y: t * 100, nx: -1, ny: 0 });
    }

    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dxCss = (b.x - a.x) / sx;
      const dyCss = (b.y - a.y) / sy;
      cum.push(cum[i - 1] + Math.hypot(dxCss, dyCss));
    }
    const last = pts[pts.length - 1];
    const first = pts[0];
    const closeLen = Math.hypot((first.x - last.x) / sx, (first.y - last.y) / sy);
    const totalCss = cum[cum.length - 1] + closeLen;

    const perimeterAt = (s: number): PerimeterPoint => {
      const sm = ((s % totalCss) + totalCss) % totalCss;
      for (let i = 1; i < pts.length; i++) {
        if (sm <= cum[i]) {
          const segLen = cum[i] - cum[i - 1];
          const t = segLen > 0 ? (sm - cum[i - 1]) / segLen : 0;
          const a = pts[i - 1];
          const b = pts[i];
          return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            nx: b.nx,
            ny: b.ny,
          };
        }
      }
      const lastIdx = pts.length - 1;
      const segLen = closeLen;
      const t = segLen > 0 ? (sm - cum[lastIdx]) / segLen : 0;
      return {
        x: pts[lastIdx].x + (first.x - pts[lastIdx].x) * t,
        y: pts[lastIdx].y + (first.y - pts[lastIdx].y) * t,
        nx: 0,
        ny: 1,
      };
    };

    const bodyPath = pts.reduce(
      (acc, p, i) =>
        acc + (i === 0
          ? `M ${p.x.toFixed(3)} ${p.y.toFixed(3)}`
          : ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`),
      ''
    ) + ' Z';

    const sampler: BaseSampler = { bodyPath, perimeterAt, totalCss };
    return sampler;
  },
  defaults: DEFAULTS,
  insets: (params) => {
    const depth = params?.depth ?? DEFAULTS.depth;
    const leftCap = params?.leftEdge ?? DEFAULTS.leftEdge;
    const rightCap = params?.rightEdge ?? DEFAULTS.rightEdge;
    const left = resolveEdge(leftCap);
    const right = resolveEdge(rightCap);
    // Sample the profiles to compute (a) each side's average offset, used to
    // shift padding so text reads centered in the visible silhouette (not the
    // bounding rect), and (b) each side's deepest inward cut, the floor below
    // which padding mustn't drop or text would crash into the cap.
    // Trapezoid integration over [0, 1] — exact for piecewise-linear profiles
    // (chevron, slant, slant-up) and accurate enough for the curved ones.
    const N = 32;
    let avgLeft = 0;
    let avgRight = 0;
    let maxLeftInward = 0;
    let maxRightInward = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const l = left(t, depth);
      const r = right(t, depth);
      const w = i === 0 || i === N ? 0.5 : 1;
      avgLeft += (w * l) / N;
      avgRight += (w * r) / N;
      if (l > maxLeftInward) maxLeftInward = l;
      if (-r > maxRightInward) maxRightInward = -r;
    }
    // Desired asymmetry: padLeft - padRight = avgLeft + avgRight (so the text
    // centroid sits at the silhouette's centroid). Hold padLeft + padRight = 2 * depth.
    const shift = (avgLeft + avgRight) / 2;
    const leftPad = Math.max(maxLeftInward, depth + shift);
    const rightPad = Math.max(maxRightInward, depth - shift);
    return { top: 0, right: rightPad, bottom: 0, left: leftPad };
  },
};

export default Powerline;
