import type { BaseModule, BaseSampler, PerimeterPoint } from './types';
import { lerp, trimNumber, wrapPositive } from '@weasel-js/geom';

/** What `baseParams` takes on a badge whose `base` is `rounded-rect`. */
export interface BadgeRoundedRectBaseParams {
  /** 0..1 fraction of the maximum corner rounding (1 = full pill / ellipse). */
  erosion?: number;
  /** Stretch the corner arcs horizontally vs vertically. 1 = circular at the badge's
   *  native aspect; >1 wider corner arcs; <1 taller corner arcs. */
  eccentricity?: number;
  /** 0..1 vertical squeeze applied to the left and right ends, linearly tapering toward
   *  the middle. 1 = ends fully collapsed to the centerline (lemon/lens silhouette). */
  pinch?: number;
}

const DEFAULTS: Required<BadgeRoundedRectBaseParams> = { erosion: 0.16, eccentricity: 1, pinch: 0 };

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
  const ecc = Math.max(0.1, Math.min(eccentricity, 10));
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

type Outline = Pick<BaseSampler, 'perimeterAt' | 'totalCss'>;

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
  return { perimeterAt, totalCss };
}

/**
 * `outline` squeezed toward the centerline by `pinch` (0..1), more the farther a point sits from
 * x=50 and fully at the ends when 1: its path sampled densely, its normals from the warped tangent.
 */
function pinchedSampler({ perimeterAt, totalCss }: Outline, pinch: number, { sx, sy }: Corners): BaseSampler {
  const pinchY = (x: number, y: number): number => {
    const d = Math.abs(x - 50) / 50;
    return lerp(50, y, 1 - d * pinch);
  };
  const N = 240;
  const samplePts: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const sCss = (i / N) * totalCss;
    const pt = perimeterAt(sCss);
    samplePts.push({ x: pt.x, y: pinchY(pt.x, pt.y) });
  }
  const bodyPath = samplePts.reduce((acc, p, i) =>
    acc + (i === 0 ? `M ${trimNumber(p.x, 3)} ${trimNumber(p.y, 3)}` : ` L ${trimNumber(p.x, 3)} ${trimNumber(p.y, 3)}`),
    '') + ' Z';

  const pinchedAt = (s: number): PerimeterPoint => {
    const sm = wrapPositive(s, totalCss);
    const pt = perimeterAt(sm);
    const x = pt.x;
    const y = pinchY(pt.x, pt.y);
    const eps = totalCss / 480;
    const a = perimeterAt(sm - eps);
    const b = perimeterAt(sm + eps);
    const ax = a.x, ay = pinchY(a.x, a.y);
    const bx = b.x, by = pinchY(b.x, b.y);
    const tx = (bx - ax) / sx;
    const ty = (by - ay) / sy;
    const tl = Math.hypot(tx, ty) || 1;
    return { x, y, nx: ty / tl, ny: -tx / tl };
  };
  return { bodyPath, perimeterAt: pinchedAt, totalCss };
}

const RoundedRect: BaseModule<BadgeRoundedRectBaseParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const erosion = Math.max(0, Math.min(cfg.erosion, 1));
    const corners = cornersFor(erosion, cfg.eccentricity, boxW, boxH);
    const outline = roundedRectOutline(corners);
    // Erosion supersedes pinch: a fully rounded end already tapers to the centerline, so a full pill ignores it.
    const pinch = Math.max(0, Math.min(cfg.pinch, 1)) * (1 - erosion);
    if (pinch !== 0) return pinchedSampler(outline, pinch, corners);
    const sampler: BaseSampler = { bodyPath: roundedRectPath(corners), ...outline };
    return sampler;
  },
  defaults: DEFAULTS,
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
};

export default RoundedRect;
