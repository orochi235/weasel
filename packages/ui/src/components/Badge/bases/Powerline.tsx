import { resolveEdge, type EdgeCap, type EdgePoint } from './edgeProfiles';
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

// Insets can't see the measured height. Profile averages don't depend on it;
// a cap whose shape does (puzzle) is averaged at a typical row height.
const INSETS_HEIGHT = 20;

const Powerline: BaseModule<PowerlineParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const left = resolveEdge(cfg.leftEdge)(cfg.depth, boxH);
    const right = resolveEdge(cfg.rightEdge)(cfg.depth, boxH);
    const sx = 100 / boxW;
    const sy = 100 / boxH;

    const pts: { x: number; y: number; nx: number; ny: number }[] = [];

    // Top corners are the edges' own first points, so a profile that
    // protrudes/cuts at the top (e.g. slant-up) doesn't introduce a corner
    // kink between the flat top and the edge.
    const lTop = left[0];
    const rTop = right[0];
    pts.push({ x: lTop.x * sx, y: lTop.y * sy, nx: 0, ny: -1 });
    pts.push({ x: (boxW + rTop.x) * sx, y: rTop.y * sy, nx: 0, ny: -1 });

    for (let i = 1; i < right.length - 1; i++) {
      pts.push({ x: (boxW + right[i].x) * sx, y: right[i].y * sy, nx: 1, ny: 0 });
    }

    const rBot = right[right.length - 1];
    const lBot = left[left.length - 1];
    pts.push({ x: (boxW + rBot.x) * sx, y: rBot.y * sy, nx: 0, ny: 1 });
    pts.push({ x: lBot.x * sx, y: lBot.y * sy, nx: 0, ny: 1 });

    for (let i = left.length - 2; i >= 1; i--) {
      pts.push({ x: left[i].x * sx, y: left[i].y * sy, nx: -1, ny: 0 });
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
    const left = resolveEdge(leftCap)(depth, INSETS_HEIGHT);
    const right = resolveEdge(rightCap)(depth, INSETS_HEIGHT);
    // Each side's (a) average offset, used to shift padding so text reads
    // centered in the visible silhouette (not the bounding rect), and (b)
    // deepest inward cut, the floor below which padding mustn't drop or text
    // would crash into the cap.
    const avgOffset = (edge: EdgePoint[]) => {
      let area = 0;
      for (let i = 1; i < edge.length; i++) {
        area += ((edge[i - 1].x + edge[i].x) / 2) * (edge[i].y - edge[i - 1].y);
      }
      return area / INSETS_HEIGHT;
    };
    const avgLeft = avgOffset(left);
    const avgRight = avgOffset(right);
    const maxLeftInward = Math.max(0, ...left.map((p) => p.x));
    const maxRightInward = Math.max(0, ...right.map((p) => -p.x));
    // Desired asymmetry: padLeft - padRight = avgLeft + avgRight (so the text
    // centroid sits at the silhouette's centroid). Hold padLeft + padRight = 2 * depth.
    const shift = (avgLeft + avgRight) / 2;
    const leftPad = Math.max(maxLeftInward, depth + shift);
    const rightPad = Math.max(maxRightInward, depth - shift);
    return { top: 0, right: rightPad, bottom: 0, left: leftPad };
  },
};

export default Powerline;
