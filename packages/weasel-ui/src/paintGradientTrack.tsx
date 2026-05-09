import type { ReactNode, CSSProperties } from 'react';
import type { TrackCtx } from './RangePicker';

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

export function paintGradientTrack(opts: GradientTrackOpts): (ctx: TrackCtx) => ReactNode {
  const { gradient, samples = 16, activeRange, hatch } = opts;

  return (ctx: TrackCtx) => {
    const stops: string[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      stops.push(`${gradient(t)} ${(t * 100).toFixed(1)}%`);
    }
    const baseGradient = `linear-gradient(to right, ${stops.join(', ')})`;

    const layers: string[] = [];
    if (activeRange) {
      const lowPct = ctx.valueToFraction(activeRange[0]) * 100;
      const highPct = ctx.valueToFraction(activeRange[1]) * 100;
      const h = { ...DEFAULT_HATCH, ...hatch };
      const stripe = `repeating-linear-gradient(${h.angleDeg}deg, transparent 0 ${h.stripe}px, var(--wui-panel-bg, #fafbfc) ${h.stripe}px ${h.stripe + h.gap}px)`;
      const dimColor = `color-mix(in srgb, var(--wui-panel-bg, #fafbfc) ${h.dim}%, transparent)`;
      const dimOverlay = `linear-gradient(${dimColor}, ${dimColor})`;

      if (lowPct > 0) {
        layers.push(`${dimOverlay} left 0 / ${lowPct.toFixed(2)}% 100% no-repeat`);
        layers.push(`${stripe} left 0 / ${lowPct.toFixed(2)}% 100% no-repeat`);
      }
      if (highPct < 100) {
        const wR = (100 - highPct).toFixed(2);
        layers.push(`${dimOverlay} right 0 / ${wR}% 100% no-repeat`);
        layers.push(`${stripe} right 0 / ${wR}% 100% no-repeat`);
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
