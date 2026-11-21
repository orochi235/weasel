import type { BaseModule, BaseSampler, PerimeterPoint } from './types';
import { clampParam, withDefaults } from '../shapes/params';
import { lerp, trimNumber, wrapPositive } from '@weasel-js/geom';

/** What `baseParams` takes on a badge whose `base` is `rounded-rect`. */
export interface BadgeRoundedRectBaseParams {
  /** 0..1 fraction of the maximum corner rounding (1 = full pill / ellipse). */
  erosion?: number;
  /** Corner radius in CSS px, held to half the shorter side; when set, it replaces `erosion`. */
  radius?: number;
  /** Stretch the corner arcs horizontally vs vertically. 1 = circular at the badge's
   *  native aspect; >1 wider corner arcs; <1 taller corner arcs. */
  eccentricity?: number;
  /** 0..1 vertical squeeze applied to the left and right ends, linearly tapering toward
   *  the middle. 1 = ends fully collapsed to the centerline (lemon/lens silhouette). */
  pinch?: number;
}

const DEFAULTS: Required<Omit<BadgeRoundedRectBaseParams, 'radius'>> = { erosion: 0.16, eccentricity: 1, pinch: 0 };

const ARC_STEPS = 64;

/**
 * A quarter of an ellipse with CSS semi-axes `a` (across) and `b` (down), run from the end of its
 * `a` axis to the end of its `b` axis: its length, and the parameter angle a length along it reaches.
 */
function quarterEllipse(a: number, b: number): { length: number; angleAt: (len: number) => number } {
  const du = Math.PI / 2 / ARC_STEPS;
  const cum = [0];
  for (let i = 0; i < ARC_STEPS; i++) {
    const u = (i + 0.5) * du;
    cum.push(cum[i] + Math.hypot(a * Math.sin(u), b * Math.cos(u)) * du);
  }
  const length = cum[ARC_STEPS];
  const angleAt = (len: number): number => {
    if (length <= 0) return (Math.max(0, Math.min(len, 1)) * Math.PI) / 2;
    const l = Math.max(0, Math.min(len, length));
    let i = 0;
    while (i < ARC_STEPS - 1 && cum[i + 1] < l) i++;
    const span = cum[i + 1] - cum[i];
    return (i + (span > 0 ? (l - cum[i]) / span : 0)) * du;
  };
  return { length, angleAt };
}

interface Corners {
  /** Corner semi-axes in the 0..100 box space. */
  rx: number;
  ry: number;
  /** Box units per CSS px, across and down. */
  sx: number;
  sy: number;
}

/** The corner semi-axes a badge of `boxW` × `boxH` CSS px takes for `erosion` and `eccentricity`. */
function cornersFor(erosion: number, eccentricity: number, boxW: number, boxH: number): Corners {
  const sx = 100 / boxW;
  const sy = 100 / boxH;
  const ecc = clampParam(eccentricity, 0.1, 10, DEFAULTS.eccentricity);
  // Max corner radius in CSS = half of the shorter axis (so erosion=1 gives a full pill/ellipse).
  const cornerCss = erosion * (Math.min(boxW, boxH) / 2);
  const rx = Math.max(0, Math.min(cornerCss * sx * ecc, 50));
  const ry = Math.max(0, Math.min(cornerCss * sy / ecc, 50));
  return { rx, ry, sx, sy };
}

/** The rounded rect's outline as SVG path data. */
function roundedRectPath({ rx, ry }: Corners): string {
  return [
    `M ${rx} 0`,
    `L ${100 - rx} 0`,
    `A ${rx} ${ry} 0 0 1 100 ${ry}`,
    `L 100 ${100 - ry}`,
    `A ${rx} ${ry} 0 0 1 ${100 - rx} 100`,
    `L ${rx} 100`,
    `A ${rx} ${ry} 0 0 1 0 ${100 - ry}`,
    `L 0 ${ry}`,
    `A ${rx} ${ry} 0 0 1 ${rx} 0`,
    'Z',
  ].join(' ');
}

type Outline = Pick<BaseSampler, 'perimeterAt' | 'totalCss'> & {
  /** The CSS lengths at which each edge and corner starts, so a polyline through them keeps every corner. */
  breaks: number[];
};

/** The rounded rect's perimeter, walked by CSS length clockwise from the top edge's left end. */
function roundedRectOutline({ rx, ry, sx, sy }: Corners): Outline {
  const topCss = (100 - 2 * rx) / sx;
  const sideCss = (100 - 2 * ry) / sy;
  const arc = quarterEllipse(rx / sx, ry / sy);
  const arcCss = arc.length;

  const segments = [
    { kind: 'h-edge',   cssLen: topCss },
    { kind: 'tr-arc',   cssLen: arcCss },
    { kind: 'v-edge',   cssLen: sideCss },
    { kind: 'br-arc',   cssLen: arcCss },
    { kind: 'h-edge-b', cssLen: topCss },
    { kind: 'bl-arc',   cssLen: arcCss },
    { kind: 'v-edge-l', cssLen: sideCss },
    { kind: 'tl-arc',   cssLen: arcCss },
  ];
  const cum: number[] = [0];
  for (const s of segments) cum.push(cum[cum.length - 1] + s.cssLen);
  const totalCss = cum[cum.length - 1];

  const perimeterAt = (s: number): PerimeterPoint => {
    const sm = wrapPositive(s, totalCss);
    let segIdx = 0;
    while (segIdx < segments.length - 1 && sm > cum[segIdx + 1]) segIdx++;
    const local = sm - cum[segIdx];
    const seg = segments[segIdx];
    const t = seg.cssLen > 0 ? local / seg.cssLen : 0;
    const corner = (start: number, cxv: number, cyv: number, mirrored: boolean): PerimeterPoint => {
      const u = mirrored ? Math.PI / 2 - arc.angleAt(seg.cssLen - local) : arc.angleAt(local);
      const ang = start + u;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      const nx = (ry / sy) * c;
      const ny = (rx / sx) * sn;
      const nl = Math.hypot(nx, ny);
      return {
        x: cxv + rx * c,
        y: cyv + ry * sn,
        nx: nl > 0 ? nx / nl : c,
        ny: nl > 0 ? ny / nl : sn,
      };
    };
    switch (seg.kind) {
      case 'h-edge':
        return { x: rx + (100 - 2 * rx) * t, y: 0, nx: 0, ny: -1 };
      case 'tr-arc':
        return corner(-Math.PI / 2, 100 - rx, ry, true);
      case 'v-edge':
        return { x: 100, y: ry + (100 - 2 * ry) * t, nx: 1, ny: 0 };
      case 'br-arc':
        return corner(0, 100 - rx, 100 - ry, false);
      case 'h-edge-b':
        return { x: (100 - rx) - (100 - 2 * rx) * t, y: 100, nx: 0, ny: 1 };
      case 'bl-arc':
        return corner(Math.PI / 2, rx, 100 - ry, true);
      case 'v-edge-l':
        return { x: 0, y: (100 - ry) - (100 - 2 * ry) * t, nx: -1, ny: 0 };
      case 'tl-arc':
        return corner(Math.PI, rx, ry, false);
    }
    return { x: 0, y: 0, nx: 0, ny: -1 };
  };
  return { perimeterAt, totalCss, breaks: cum.slice(0, -1) };
}

/**
 * `outline` squeezed toward the centerline by `pinch` (0..1), more the farther a point sits from
 * x=50 and fully at the ends when 1: its path sampled densely, walked by the squeezed outline's
 * own CSS length, with normals from the warped tangent.
 */
function pinchedSampler({ perimeterAt, totalCss, breaks }: Outline, pinch: number, { sx, sy }: Corners): BaseSampler {
  const pinchY = (x: number, y: number): number => {
    const d = Math.abs(x - 50) / 50;
    return lerp(50, y, 1 - d * pinch);
  };
  const warped = (s: number): { x: number; y: number } => {
    const pt = perimeterAt(s);
    return { x: pt.x, y: pinchY(pt.x, pt.y) };
  };
  const N = 240;
  const at = [...new Set([...Array.from({ length: N }, (_, i) => (i / N) * totalCss), ...breaks])].sort((a, b) => a - b);
  const samplePts = at.map(warped);
  const bodyPath = samplePts.reduce((acc, p, i) =>
    acc + (i === 0 ? `M ${trimNumber(p.x, 3)} ${trimNumber(p.y, 3)}` : ` L ${trimNumber(p.x, 3)} ${trimNumber(p.y, 3)}`),
    '') + ' Z';

  // Squeezed CSS length at each sample, closing back to the first at `totalCss`.
  at.push(totalCss);
  samplePts.push(samplePts[0]);
  const cum = [0];
  for (let i = 1; i < samplePts.length; i++) {
    const a = samplePts[i - 1], b = samplePts[i];
    cum.push(cum[i - 1] + Math.hypot((b.x - a.x) / sx, (b.y - a.y) / sy));
  }
  const pinchedTotal = cum[cum.length - 1];
  /** The unsqueezed length that `len` along the squeezed outline reaches. */
  const sourceAt = (len: number): number => {
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (cum[mid] <= len) lo = mid; else hi = mid;
    }
    const span = cum[hi] - cum[lo];
    return lerp(at[lo], at[hi], span > 0 ? (len - cum[lo]) / span : 0);
  };

  const pinchedAt = (len: number): PerimeterPoint => {
    const sm = sourceAt(wrapPositive(len, pinchedTotal));
    const pt = perimeterAt(sm);
    const x = pt.x;
    const y = pinchY(pt.x, pt.y);
    const eps = totalCss / 480;
    const a = warped(sm - eps);
    const b = warped(sm + eps);
    const tx = (b.x - a.x) / sx;
    const ty = (b.y - a.y) / sy;
    const tl = Math.hypot(tx, ty);
    // A full pinch collapses each end edge to a point, where the warped tangent vanishes.
    if (tl < 1e-9) return { x, y, nx: pt.nx, ny: pt.ny };
    return { x, y, nx: ty / tl, ny: -tx / tl };
  };
  return { bodyPath, perimeterAt: pinchedAt, totalCss: pinchedTotal };
}

const RoundedRect: BaseModule<BadgeRoundedRectBaseParams> = {
  build: (params, boxW, boxH) => {
    const cfg = withDefaults<BadgeRoundedRectBaseParams & typeof DEFAULTS>(DEFAULTS, params);
    const half = Math.min(boxW, boxH) / 2;
    const byRadius = cfg.radius !== undefined && !Number.isNaN(cfg.radius) && half > 0;
    const erosion = clampParam(byRadius ? cfg.radius! / half : cfg.erosion, 0, 1, DEFAULTS.erosion);
    const corners = cornersFor(erosion, cfg.eccentricity, boxW, boxH);
    const outline = roundedRectOutline(corners);
    // Erosion supersedes pinch: a fully rounded end already tapers to the centerline, so a full pill ignores it.
    const pinch = clampParam(cfg.pinch, 0, 1, DEFAULTS.pinch) * (1 - erosion);
    if (pinch !== 0) return pinchedSampler(outline, pinch, corners);
    const sampler: BaseSampler = { bodyPath: roundedRectPath(corners), ...outline };
    return sampler;
  },
  defaults: DEFAULTS,
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
};

export default RoundedRect;
