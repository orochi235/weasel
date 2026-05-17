import { useId } from 'react';
import type { EffectModule } from '../bases/types';

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface SheenEffectParams {
  lightFrom?: Corner;
  /** Peak gradient opacity (0..1). */
  intensity?: number;
}

const DEFAULTS: Required<SheenEffectParams> = { lightFrom: 'tl', intensity: 0.22 };

// Gradient runs from the shadow corner (0%) to the lit corner (100%).
const FACE_COORDS: Record<Corner, { x1: string; y1: string; x2: string; y2: string }> = {
  tl: { x1: '100%', y1: '100%', x2: '0%', y2: '0%' },
  tr: { x1: '0%', y1: '100%', x2: '100%', y2: '0%' },
  bl: { x1: '100%', y1: '0%', x2: '0%', y2: '100%' },
  br: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
};

const Sheen: EffectModule<SheenEffectParams> = {
  Component: ({ sampler, variant, params }) => {
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = { ...DEFAULTS, ...params };
    const gradId = useId();
    const clipId = useId();
    const peak = Math.max(0, Math.min(cfg.intensity, 1));
    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
          <linearGradient id={gradId} {...FACE_COORDS[cfg.lightFrom]}>
            <stop offset="0%"   stopColor="black" stopOpacity={peak} />
            <stop offset="45%"  stopColor="black" stopOpacity="0.04" />
            <stop offset="58%"  stopColor="white" stopOpacity="0.04" />
            <stop offset="100%" stopColor="white" stopOpacity={peak} />
          </linearGradient>
        </defs>
        <rect clipPath={`url(#${clipId})`} x="0" y="0" width="100" height="100" fill={`url(#${gradId})`} style={{ pointerEvents: 'none' }} />
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Sheen;
