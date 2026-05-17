import { useId } from 'react';
import type { EffectModule } from '../bases/types';

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface BevelEffectParams {
  /** Bevel band width in CSS px. */
  bevelWidth?: number;
  /** Which corner the light originates from (drives the highlight/shadow distribution across edges). */
  lightFrom?: Corner;
}

const DEFAULTS: Required<BevelEffectParams> = { bevelWidth: 6, lightFrom: 'tl' };

function bevelClasses(lightFrom: Corner) {
  const isTop = lightFrom[0] === 't';
  const isLeft = lightFrom[1] === 'l';
  return {
    top: isTop ? 'badge-bevel-light' : 'badge-bevel-dark',
    bottom: isTop ? 'badge-bevel-dark' : 'badge-bevel-light',
    left: isLeft ? 'badge-bevel-medium-light' : 'badge-bevel-medium-dark',
    right: isLeft ? 'badge-bevel-medium-dark' : 'badge-bevel-medium-light',
  };
}

const Bevel: EffectModule<BevelEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = { ...DEFAULTS, ...params };
    const clipId = useId();
    const sx = 100 / boxW, sy = 100 / boxH;
    const bx = cfg.bevelWidth * sx;
    const by = cfg.bevelWidth * sy;
    const cls = bevelClasses(cfg.lightFrom);
    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <polygon className={cls.top}    points={`0,0 100,0 ${100 - bx},${by} ${bx},${by}`} />
          <polygon className={cls.left}   points={`0,100 0,0 ${bx},${by} ${bx},${100 - by}`} />
          <polygon className={cls.right}  points={`100,0 100,100 ${100 - bx},${100 - by} ${100 - bx},${by}`} />
          <polygon className={cls.bottom} points={`100,100 0,100 ${bx},${100 - by} ${100 - bx},${100 - by}`} />
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Bevel;
