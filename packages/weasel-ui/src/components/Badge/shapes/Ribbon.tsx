import type { ShapeModule, ShapeComposeSpec } from '../types';

export type RibbonEnd = 'inward' | 'outward' | 'flat';

export interface RibbonParams {
  left?: RibbonEnd;
  right?: RibbonEnd;
  taperWidth?: number;
}

const DEFAULTS: Required<RibbonParams> = { left: 'inward', right: 'outward', taperWidth: 12 };

interface SidePoints { top: [number, number]; mid: [number, number] | null; bottom: [number, number] }

function sidePoints(mode: RibbonEnd, xBase: number, sign: number, taper: number): SidePoints {
  switch (mode) {
    case 'flat':
      return { top: [xBase, 0], mid: null, bottom: [xBase, 100] };
    case 'outward':
      return { top: [xBase + sign * taper, 0], mid: [xBase, 50], bottom: [xBase + sign * taper, 100] };
    case 'inward':
      return { top: [xBase, 0], mid: [xBase + sign * taper, 50], bottom: [xBase, 100] };
  }
}

function sideInset(mode: RibbonEnd, taper: number): number {
  const t = Math.max(0, Math.min(taper, 50));
  switch (mode) {
    case 'flat':    return 4;
    case 'outward': return Math.round(t * 0.7);
    case 'inward':  return Math.round(t * 0.8);
  }
}

const Ribbon: ShapeModule<RibbonParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    const t = Math.max(0, Math.min(cfg.taperWidth, 50));
    const l = sidePoints(cfg.left, 0, 1, t);
    const r = sidePoints(cfg.right, 100, -1, t);
    // Clockwise: l.top → r.top → r.mid? → r.bottom → l.bottom → l.mid? → close.
    const verts: [number, number][] = [l.top];
    verts.push(r.top);
    if (r.mid) verts.push(r.mid);
    verts.push(r.bottom);
    verts.push(l.bottom);
    if (l.mid) verts.push(l.mid);
    return { base: 'polygon', baseParams: { vertices: verts } };
  },
  insets: (params) => {
    const cfg = { ...DEFAULTS, ...params };
    return { top: 0, right: sideInset(cfg.right, cfg.taperWidth), bottom: 0, left: sideInset(cfg.left, cfg.taperWidth) };
  },
  stretches: true,
  defaults: DEFAULTS,
};

export default Ribbon;
