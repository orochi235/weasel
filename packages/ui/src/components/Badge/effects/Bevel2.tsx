import { useId } from 'react';
import type { EffectModule } from '../bases/types';
import { DEG_TO_RAD } from '@weasel-js/geom';
import { finiteParams } from '../shapes/params';
import { bevelBands } from './bevelBands';

/** What an effect of type `bevel2` takes as `params`. */
export interface BadgeBevel2EffectParams {
  /** Bevel band width in CSS px. */
  bevelWidth?: number;
  /** Compass angle the light originates from, in degrees. 0° = top, 90° =
   *  right, 180° = bottom, 270° = left (CSS `linear-gradient` convention). */
  lightFrom?: number;
}

const DEFAULTS: Required<BadgeBevel2EffectParams> = { bevelWidth: 6, lightFrom: 315 };

// Six shade buckets from brightest to darkest. Each maps to a CSS class.
const SHADE_CLASSES = [
  'badge-bevel-light',         // brightest (normal points straight at light)
  'badge-bevel-medium-light',
  'badge-bevel-medium-light',
  'badge-bevel-medium-dark',
  'badge-bevel-medium-dark',
  'badge-bevel-dark',          // darkest (normal points away from light)
];

function lightDirFor(angleDeg: unknown): { lx: number; ly: number } {
  if (typeof angleDeg !== 'number' || !Number.isFinite(angleDeg)) {
    throw new RangeError(`a bevel2 effect's lightFrom must be a finite angle in degrees, not ${String(angleDeg)}`);
  }
  // Compass convention (0° = up, clockwise). Returns the unit vector pointing
  // outward from the badge toward the light source.
  const rad = angleDeg * DEG_TO_RAD;
  return { lx: Math.sin(rad), ly: -Math.cos(rad) };
}

const Bevel2: EffectModule<BadgeBevel2EffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    const clipId = useId();
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = finiteParams({ ...DEFAULTS, ...params }, DEFAULTS, ['lightFrom']);
    const { lx, ly } = lightDirFor(cfg.lightFrom);
    // dot(n, lightDir) where light points FROM the corner OUTWARD: surfaces whose
    // outward normal aligns with -light (facing the light source) are brightest.
    const bucketFor = (nx: number, ny: number) => {
      const t = Math.max(0, Math.min((1 - (nx * lx + ny * ly)) / 2, 0.9999));
      return Math.floor(t * SHADE_CLASSES.length);
    };
    const bands = bevelBands(sampler, boxW, boxH, cfg.bevelWidth, bucketFor);

    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {bands.map((band, i) => (
            <path key={i} className={SHADE_CLASSES[band.key]} d={band.d} />
          ))}
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Bevel2;
