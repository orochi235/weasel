import { useId } from 'react';
import type { EffectModule } from '../bases/types';

export interface WoodgrainEffectParams {
  /** Number of grain curves. */
  lines?: number;
  /** Number of knot circles. */
  knots?: number;
  /** Overall grain opacity (0..1). */
  intensity?: number;
}

const DEFAULTS: Required<WoodgrainEffectParams> = { lines: 4, knots: 2, intensity: 0.55 };

// Deterministic per-line/knot wobble.
function osc(seed: number) {
  return Math.sin(seed * 1.73 + 0.5);
}

const Woodgrain: EffectModule<WoodgrainEffectParams> = {
  Component: ({ sampler, variant, params }) => {
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = { ...DEFAULTS, ...params };
    const clipId = useId();
    const lines: string[] = [];
    for (let i = 0; i < cfg.lines; i++) {
      const y = ((i + 1) / (cfg.lines + 1)) * 100;
      // Two control points, slight vertical wobble.
      const dy1 = osc(i * 2 + 1) * 4;
      const dy2 = osc(i * 2 + 2) * 4;
      lines.push(`M -5 ${y.toFixed(2)} Q 35 ${(y + dy1).toFixed(2)} 60 ${y.toFixed(2)} T 105 ${(y + dy2).toFixed(2)}`);
    }
    const knotPositions: [number, number][] = [];
    for (let i = 0; i < cfg.knots; i++) {
      const cx = 30 + osc(i * 3 + 0.7) * 30 + 20;
      const cy = 50 + osc(i * 3 + 1.3) * 30;
      knotPositions.push([cx, cy]);
    }
    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`} opacity={Math.max(0, Math.min(cfg.intensity, 1))} style={{ pointerEvents: 'none' }}>
          {lines.map((d, i) => (
            <path key={`l${i}`} className="badge-stroke" d={d} fill="none" />
          ))}
          {knotPositions.map(([cx, cy], i) => (
            <g key={`k${i}`}>
              <ellipse className="badge-stroke" cx={cx} cy={cy} rx={3} ry={2.4} fill="none" />
              <ellipse className="badge-stroke" cx={cx} cy={cy} rx={1.2} ry={1} fill="none" />
            </g>
          ))}
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Woodgrain;
