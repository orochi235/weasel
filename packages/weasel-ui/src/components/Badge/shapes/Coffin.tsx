import type { ShapeModule } from '../types';

export interface CoffinParams {
  headX?: number;
  headHalfHeight?: number;
  shoulderX?: number;
  shoulderHalfHeight?: number;
  footX?: number;
  footHalfHeight?: number;
}

const DEFAULTS: Required<CoffinParams> = {
  headX: 6,
  headHalfHeight: 23,
  shoulderX: 33,
  shoulderHalfHeight: 36,
  footX: 100,
  footHalfHeight: 29,
};

function coffinPath(cfg: Required<CoffinParams>) {
  const hX = Math.max(0, Math.min(cfg.headX, 40));
  const sX = Math.max(hX + 1, Math.min(cfg.shoulderX, 70));
  const fX = Math.max(sX + 1, Math.min(cfg.footX, 100));
  const hH = Math.max(2, Math.min(cfg.headHalfHeight, 50));
  // shoulderHalfHeight is a non-negative delta above headHalfHeight (so shoulder >= head).
  const sDelta = Math.max(0, Math.min(cfg.shoulderHalfHeight, 50));
  const sH = Math.min(50, hH + sDelta);
  const fH = Math.max(2, Math.min(cfg.footHalfHeight, 50));
  return [
    `M ${hX} ${50 - hH}`,
    `L ${sX} ${50 - sH}`,
    `L ${fX} ${50 - fH}`,
    `L ${fX} ${50 + fH}`,
    `L ${sX} ${50 + sH}`,
    `L ${hX} ${50 + hH}`,
    'Z',
  ].join(' ');
}

const Coffin: ShapeModule<CoffinParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = coffinPath(cfg);
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
  insets: { top: 4, right: 6, bottom: 4, left: 11 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Coffin;
