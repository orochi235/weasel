import type { BaseModule, BaseSampler, PerimeterPoint } from './types';

export interface RoundedRectParams {
  /** 0..1 fraction of the maximum corner rounding (1 = full pill / ellipse). */
  erosion?: number;
  /** Stretch the corner arcs horizontally vs vertically. 1 = circular at the badge's
   *  native aspect; >1 wider corner arcs; <1 taller corner arcs. */
  eccentricity?: number;
  /** 0..1 vertical squeeze applied to the left and right ends, linearly tapering toward
   *  the middle. 1 = ends fully collapsed to the centerline (lemon/lens silhouette). */
  pinch?: number;
}

const DEFAULTS: Required<RoundedRectParams> = { erosion: 0.16, eccentricity: 1, pinch: 0 };

const RoundedRect: BaseModule<RoundedRectParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const erosion = Math.max(0, Math.min(cfg.erosion, 1));
    const ecc = Math.max(0.1, Math.min(cfg.eccentricity, 10));
    // Max corner radius in CSS = half of the shorter axis (so erosion=1 gives a full pill/ellipse).
    const cornerCss = erosion * (Math.min(boxW, boxH) / 2);
    const rxC = cornerCss * sx * ecc;
    const ryC = cornerCss * sy / ecc;
    const rx = Math.max(0, Math.min(rxC, 50));
    const ry = Math.max(0, Math.min(ryC, 50));

    const topCss = (100 - 2 * rx) / sx;
    const sideCss = (100 - 2 * ry) / sy;
    const denom = cornerCss + cornerCss || 1;
    const hh = 0;
    const arcCss = (Math.PI * denom * (1 + 3 * hh / (10 + Math.sqrt(4 - 3 * hh)))) / 4;

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
      const sm = ((s % totalCss) + totalCss) % totalCss;
      let segIdx = 0;
      while (segIdx < segments.length - 1 && sm > cum[segIdx + 1]) segIdx++;
      const local = sm - cum[segIdx];
      const seg = segments[segIdx];
      const t = seg.cssLen > 0 ? local / seg.cssLen : 0;
      switch (seg.kind) {
        case 'h-edge':
          return { x: rx + (100 - 2 * rx) * t, y: 0, nx: 0, ny: -1 };
        case 'tr-arc': {
          const ang = -Math.PI / 2 + t * (Math.PI / 2);
          return {
            x: (100 - rx) + rx * Math.cos(ang),
            y: ry + ry * Math.sin(ang),
            nx: Math.cos(ang),
            ny: Math.sin(ang),
          };
        }
        case 'v-edge':
          return { x: 100, y: ry + (100 - 2 * ry) * t, nx: 1, ny: 0 };
        case 'br-arc': {
          const ang = t * (Math.PI / 2);
          return {
            x: (100 - rx) + rx * Math.cos(ang),
            y: (100 - ry) + ry * Math.sin(ang),
            nx: Math.cos(ang),
            ny: Math.sin(ang),
          };
        }
        case 'h-edge-b':
          return { x: (100 - rx) - (100 - 2 * rx) * t, y: 100, nx: 0, ny: 1 };
        case 'bl-arc': {
          const ang = Math.PI / 2 + t * (Math.PI / 2);
          return {
            x: rx + rx * Math.cos(ang),
            y: (100 - ry) + ry * Math.sin(ang),
            nx: Math.cos(ang),
            ny: Math.sin(ang),
          };
        }
        case 'v-edge-l':
          return { x: 0, y: (100 - ry) - (100 - 2 * ry) * t, nx: -1, ny: 0 };
        case 'tl-arc': {
          const ang = Math.PI + t * (Math.PI / 2);
          return {
            x: rx + rx * Math.cos(ang),
            y: ry + ry * Math.sin(ang),
            nx: Math.cos(ang),
            ny: Math.sin(ang),
          };
        }
      }
      return { x: 0, y: 0, nx: 0, ny: -1 };
    };

    // Vertical pinch toward the centerline, parameterised by horizontal distance from x=50.
    // pinch=0 → identity; pinch=1 → collapses the left/right ends to y=50.
    // Erosion supersedes pinch: as the corners round into a full ellipse there's nothing
    // structurally left to pinch (the ends already taper to the centerline). Scale by
    // (1 - erosion) so a fully pilled badge ignores the slider.
    const pinch = Math.max(0, Math.min(cfg.pinch, 1)) * (1 - erosion);
    const pinchY = (x: number, y: number): number => {
      if (pinch === 0) return y;
      const d = Math.abs(x - 50) / 50;
      return 50 + (y - 50) * (1 - d * pinch);
    };

    let bodyPath: string;
    let perimeterAtFinal = perimeterAt;
    if (pinch === 0) {
      bodyPath = [
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
    } else {
      // Sample the unpinched perimeter densely and apply the y-pinch to each point.
      const N = 240;
      const samplePts: { x: number; y: number }[] = [];
      for (let i = 0; i < N; i++) {
        const sCss = (i / N) * totalCss;
        const pt = perimeterAt(sCss);
        samplePts.push({ x: pt.x, y: pinchY(pt.x, pt.y) });
      }
      bodyPath = samplePts.reduce((acc, p, i) =>
        acc + (i === 0 ? `M ${p.x.toFixed(3)} ${p.y.toFixed(3)}` : ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`),
        '') + ' Z';

      // Warped perimeterAt: pinched point + normal recomputed from local warped tangent.
      perimeterAtFinal = (s: number) => {
        const sm = ((s % totalCss) + totalCss) % totalCss;
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
    }

    const sampler: BaseSampler = { bodyPath, perimeterAt: perimeterAtFinal, totalCss };
    return sampler;
  },
  defaults: DEFAULTS,
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
};

export default RoundedRect;
