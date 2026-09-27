import type { ReactNode, CSSProperties } from 'react';
import type { TrackCtx } from './components/Slider';

/**
 * Options for {@link paintGradientTrack}.
 *
 * `gradient` maps a normalized position along the slider's value span (0 to
 * 1) to a CSS color; `samples` is how many stops the resulting
 * linear-gradient uses. The ramp is laid on the same span as the thumbs, so a
 * thumb at 0.3 sits over `gradient(0.3)`; any track beyond the span takes the
 * end colors.
 * `activeRange`, given in the slider's own value units, keeps that span at
 * full strength and dims + hatches the rest.
 */
export type GradientTrackOpts = {
  gradient: (t: number) => string;
  samples?: number;
  activeRange?: [number, number];
  hatch?: {
    angleDeg?: number;
    stripe?: number;
    gap?: number;
    dim?: number;
  };
};

const DEFAULT_HATCH = { angleDeg: 135, stripe: 2, gap: 4, dim: 75 };

/**
 * Builds a `Slider` `renderTrack` function that paints the track as a
 * sampled color gradient, optionally dimming and hatching the portions
 * outside an active range.
 */
export function paintGradientTrack(opts: GradientTrackOpts): (ctx: TrackCtx) => ReactNode {
  const { gradient, samples = 16, activeRange, hatch } = opts;

  return (ctx: TrackCtx) => {
    const stops: string[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      stops.push(`${gradient(t)} ${ctx.fractionToPosition(t)}`);
    }
    const baseGradient = `linear-gradient(to right, ${stops.join(', ')})`;

    const layers: string[] = [];
    if (activeRange) {
      const low = ctx.valueToFraction(activeRange[0]);
      const high = ctx.valueToFraction(activeRange[1]);
      const h = { ...DEFAULT_HATCH, ...hatch };
      const stripe = `repeating-linear-gradient(${h.angleDeg}deg, transparent 0 ${h.stripe}px, var(--wzl-surface) ${h.stripe}px ${h.stripe + h.gap}px)`;
      const dimColor = `color-mix(in srgb, var(--wzl-surface) ${h.dim}%, transparent)`;
      const dimOverlay = `linear-gradient(${dimColor}, ${dimColor})`;

      if (low > 0) {
        const wL = ctx.fractionToPosition(low);
        layers.push(`${dimOverlay} left 0 / ${wL} 100% no-repeat`);
        layers.push(`${stripe} left 0 / ${wL} 100% no-repeat`);
      }
      if (high < 1) {
        const wR = `calc(100% - ${ctx.fractionToPosition(high)})`;
        layers.push(`${dimOverlay} right 0 / ${wR} 100% no-repeat`);
        layers.push(`${stripe} right 0 / ${wR} 100% no-repeat`);
      }
    }
    layers.push(baseGradient);

    const style: CSSProperties = {
      position: 'absolute',
      inset: 0,
      background: layers.join(', '),
    };
    return <div style={style} />;
  };
}
