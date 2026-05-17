import type { ShapeModule } from '../types';

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

function ribbonPath(left: RibbonEnd, right: RibbonEnd, taper: number) {
  const t = Math.max(0, Math.min(taper, 50));
  const l = sidePoints(left, 0, 1, t);
  const r = sidePoints(right, 100, -1, t);
  let d = `M ${l.top[0]} ${l.top[1]}`;
  d += ` L ${r.top[0]} ${r.top[1]}`;
  if (r.mid) d += ` L ${r.mid[0]} ${r.mid[1]}`;
  d += ` L ${r.bottom[0]} ${r.bottom[1]}`;
  d += ` L ${l.bottom[0]} ${l.bottom[1]}`;
  if (l.mid) d += ` L ${l.mid[0]} ${l.mid[1]}`;
  return d + ' Z';
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
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = ribbonPath(cfg.left, cfg.right, cfg.taperWidth);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && (
          <path
            className="badge-focus"
            d={d}
            transform="translate(50 50) scale(1.06) translate(-50 -50)"
          />
        )}
      </>
    );
  },
  insets: (params) => {
    const cfg = { ...DEFAULTS, ...params };
    return { top: 0, right: sideInset(cfg.right, cfg.taperWidth), bottom: 0, left: sideInset(cfg.left, cfg.taperWidth) };
  },
  stretches: true,
  defaults: DEFAULTS,
};

export default Ribbon;
