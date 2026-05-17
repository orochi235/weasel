import type { ShapeModule } from '../types';

export interface HouseParams {
  eaveY?: number;
  peakHeight?: number;
  roofOverhang?: number;
}

const DEFAULTS: Required<HouseParams> = { eaveY: 32, peakHeight: 32, roofOverhang: 0 };

function housePath(eaveY: number, peakHeight: number, overhang: number) {
  const W = 100, H = 100;
  const ey = Math.max(2, Math.min(eaveY, H - 5));
  const peakY = ey - Math.max(0, peakHeight);
  const ov = Math.max(0, Math.min(overhang, 12));
  return [
    `M ${50} ${peakY}`,
    `L ${W + ov} ${ey}`,
    `L ${W} ${ey}`,
    `L ${W} ${H}`,
    `L ${0} ${H}`,
    `L ${0} ${ey}`,
    `L ${-ov} ${ey}`,
    'Z',
  ].join(' ');
}

const House: ShapeModule<HouseParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = housePath(cfg.eaveY, cfg.peakHeight, cfg.roofOverhang);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && (
          <path className="badge-focus" d={d} transform="translate(50 50) scale(1.05) translate(-50 -50)" />
        )}
      </>
    );
  },
  insets: { top: 10, right: 4, bottom: 0, left: 4 },
  stretches: true,
  defaults: DEFAULTS,
};

export default House;
