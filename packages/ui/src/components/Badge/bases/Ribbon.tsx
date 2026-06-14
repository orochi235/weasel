import type { BaseModule } from './types';
import { polygonSampler } from './polygonSampler';

export type RibbonEnd = 'inward' | 'outward' | 'flat';

export interface RibbonParams {
  left?: RibbonEnd;
  right?: RibbonEnd;
  /** Taper depth in CSS px. Stays fixed regardless of badge width — viewBox
   *  vertices are computed at build time using `boxW`. */
  taperWidth?: number;
}

const DEFAULTS: Required<RibbonParams> = { left: 'inward', right: 'outward', taperWidth: 8 };

interface SidePoints {
  top: [number, number];
  mid: [number, number] | null;
  bottom: [number, number];
}

function sidePoints(mode: RibbonEnd, xBaseVb: number, signVb: number, taperVb: number): SidePoints {
  switch (mode) {
    case 'flat':
      return { top: [xBaseVb, 0], mid: null, bottom: [xBaseVb, 100] };
    case 'outward':
      return {
        top: [xBaseVb + signVb * taperVb, 0],
        mid: [xBaseVb, 50],
        bottom: [xBaseVb + signVb * taperVb, 100],
      };
    case 'inward':
      return {
        top: [xBaseVb, 0],
        mid: [xBaseVb + signVb * taperVb, 50],
        bottom: [xBaseVb, 100],
      };
  }
}

function sideInsetCss(mode: RibbonEnd, taperCss: number): number {
  const t = Math.max(0, taperCss);
  switch (mode) {
    case 'flat':    return 4;
    case 'outward': return Math.round(t * 0.7);
    case 'inward':  return Math.round(t * 0.8);
  }
}

const Ribbon: BaseModule<RibbonParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const taperCss = Math.max(0, cfg.taperWidth);
    // Convert CSS px taper into viewBox-x units so the rendered pointer
    // is the same CSS-px depth regardless of badge width.
    const taperVb = boxW > 0 ? (taperCss / boxW) * 100 : 0;
    const l = sidePoints(cfg.left, 0, 1, taperVb);
    const r = sidePoints(cfg.right, 100, -1, taperVb);
    const verts: [number, number][] = [l.top];
    verts.push(r.top);
    if (r.mid) verts.push(r.mid);
    verts.push(r.bottom);
    verts.push(l.bottom);
    if (l.mid) verts.push(l.mid);
    return polygonSampler(verts, boxW, boxH);
  },
  insets: (params) => {
    const cfg = { ...DEFAULTS, ...params };
    return {
      top: 0,
      right: sideInsetCss(cfg.right, cfg.taperWidth),
      bottom: 0,
      left: sideInsetCss(cfg.left, cfg.taperWidth),
    };
  },
  defaults: DEFAULTS,
};

export default Ribbon;
