import type { ShapeModule } from '../types';

export interface NotchedParams {
  cornerRadius?: number;
  eccentricity?: number;
}

const DEFAULTS: Required<NotchedParams> = { cornerRadius: 14, eccentricity: 1 };

function notchedPath(r: number, ecc: number) {
  const W = 100, H = 100;
  const rx = r * ecc;
  const ry = r / ecc;
  return [
    `M ${rx} 0`,
    `L ${W - rx} 0`,
    `A ${rx} ${ry} 0 0 0 ${W} ${ry}`,
    `L ${W} ${H - ry}`,
    `A ${rx} ${ry} 0 0 0 ${W - rx} ${H}`,
    `L ${rx} ${H}`,
    `A ${rx} ${ry} 0 0 0 0 ${H - ry}`,
    `L 0 ${ry}`,
    `A ${rx} ${ry} 0 0 0 ${rx} 0`,
    'Z',
  ].join(' ');
}

const Notched: ShapeModule<NotchedParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const r = Math.max(0, Math.min(cfg.cornerRadius, 49));
    const ecc = Math.max(0.2, Math.min(cfg.eccentricity, 5));
    const d = notchedPath(r, ecc);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && (
          <path className="badge-fill" d={d} />
        )}
        {(variant === 'outline' || variant === 'solid') && (
          <path className="badge-stroke" d={d} />
        )}
        {focused && <path className="badge-focus" d={d} transform="translate(50 50) scale(1.06) translate(-50 -50)" />}
      </>
    );
  },
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Notched;
