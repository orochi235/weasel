import type { BaseModule, BaseSampler, PerimeterPoint } from './types';

export interface RoundedRectParams {
  /** 0..1 fraction of the maximum corner rounding (1 = full pill / ellipse). */
  erosion?: number;
}

const DEFAULTS: Required<RoundedRectParams> = { erosion: 0.16 };

const RoundedRect: BaseModule<RoundedRectParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const erosion = Math.max(0, Math.min(cfg.erosion, 1));
    // Max corner radius in CSS = half of the shorter axis (so erosion=1 gives a full pill/ellipse).
    const cornerCss = erosion * (Math.min(boxW, boxH) / 2);
    const rxC = cornerCss * sx;
    const ryC = cornerCss * sy;
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

    const bodyPath = [
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

    const sampler: BaseSampler = { bodyPath, perimeterAt, totalCss };
    return sampler;
  },
  defaults: DEFAULTS,
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
};

export default RoundedRect;
