import { trimNumber } from '@weasel-js/geom';
import { useId } from 'react';
import type { EffectModule } from '../bases/types';
import { outlineRegion } from '../composeOutline';
import { repeatCount, finiteParams } from '../shapes/params';

/** What an effect of type `woodgrain` takes as `params`. */
export interface BadgeWoodgrainEffectParams {
  /** Number of grain curves, a whole number up to 256. */
  lines?: number;
  /** Number of knots, a whole number up to 256. */
  knots?: number;
  /** Overall grain opacity (0..1). */
  intensity?: number;
}

const DEFAULTS: Required<BadgeWoodgrainEffectParams> = { lines: 4, knots: 2, intensity: 0.55 };

/** A knot's two rings, in CSS px, so they keep their shape however the badge stretches. */
const KNOT_RINGS = [{ rx: 3.5, ry: 2.8 }, { rx: 1.4, ry: 1.15 }];

// Deterministic per-line/knot wobble.
function osc(seed: number) {
  return Math.sin(seed * 1.73 + 0.5);
}

const Woodgrain: EffectModule<BadgeWoodgrainEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    const clipId = useId();
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = finiteParams({ ...DEFAULTS, ...params }, DEFAULTS, ['lines', 'knots']);
    const lineCount = repeatCount(cfg.lines, 0);
    const knotCount = repeatCount(cfg.knots, 0);
    const region = outlineRegion(sampler, 0);
    const x0 = region.x - 5, span = region.width + 10;
    const at = (f: number) => trimNumber(x0 + span * f, 2);
    const lines: string[] = [];
    for (let i = 0; i < lineCount; i++) {
      const y = region.y + ((i + 1) / (lineCount + 1)) * region.height;
      // Two control points, slight vertical wobble.
      const dy1 = osc(i * 2 + 1) * 4;
      const dy2 = osc(i * 2 + 2) * 4;
      lines.push(`M ${at(0)} ${trimNumber(y, 2)} Q ${at(40 / 110)} ${trimNumber(y + dy1, 2)} ${at(65 / 110)} ${trimNumber(y, 2)} T ${at(1)} ${trimNumber(y + dy2, 2)}`);
    }
    const knotPositions: [number, number][] = [];
    for (let i = 0; i < knotCount; i++) {
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
              {KNOT_RINGS.map((ring, j) => (
                <ellipse key={j} className="badge-stroke" cx={cx} cy={cy} rx={ring.rx * (100 / boxW)} ry={ring.ry * (100 / boxH)} fill="none" />
              ))}
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
