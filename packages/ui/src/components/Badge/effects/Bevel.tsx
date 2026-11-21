import { useId } from 'react';
import type { EffectModule } from '../bases/types';
import type { BadgeCorner } from '../types';
import { bevelBands } from './bevelBands';
import { lightCorner } from './lightCorner';

/** What an effect of type `bevel` takes as `params`. */
export interface BadgeBevelEffectParams {
  /** Bevel band width in CSS px. */
  bevelWidth?: number;
  /** Which corner the light originates from (drives the highlight/shadow distribution across edges). */
  lightFrom?: BadgeCorner;
}

const DEFAULTS: Required<BadgeBevelEffectParams> = { bevelWidth: 6, lightFrom: 'tl' };

type Side = 'top' | 'right' | 'bottom' | 'left';

function sideForNormal(nx: number, ny: number): Side {
  return Math.abs(ny) > Math.abs(nx)
    ? (ny < 0 ? 'top' : 'bottom')
    : (nx < 0 ? 'left' : 'right');
}

function bevelClasses(lightFrom: BadgeCorner): Record<Side, string> {
  const isTop = lightFrom[0] === 't';
  const isLeft = lightFrom[1] === 'l';
  return {
    top:    isTop  ? 'badge-bevel-light'        : 'badge-bevel-dark',
    bottom: isTop  ? 'badge-bevel-dark'         : 'badge-bevel-light',
    left:   isLeft ? 'badge-bevel-medium-light' : 'badge-bevel-medium-dark',
    right:  isLeft ? 'badge-bevel-medium-dark'  : 'badge-bevel-medium-light',
  };
}

const Bevel: EffectModule<BadgeBevelEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    const clipId = useId();
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = { ...DEFAULTS, ...params };
    const cls = bevelClasses(lightCorner(cfg.lightFrom, 'bevel'));
    const bands = bevelBands(sampler, boxW, boxH, cfg.bevelWidth, sideForNormal);

    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {bands.map((band, i) => (
            <path key={i} className={cls[band.key]} d={band.d} />
          ))}
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Bevel;
