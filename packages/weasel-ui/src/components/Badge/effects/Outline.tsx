import type { EffectModule } from '../bases/types';

export interface OutlineEffectParams {
  /** Stroke width in CSS px. */
  width?: number;
  /** Stroke color. */
  color?: string;
  /** Optional SVG dasharray (e.g. "4 2"). */
  dash?: string;
  /** CSS mix-blend-mode: 'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
   *  'difference', etc. Useful when the outline color should react to whatever's behind it. */
  blendMode?: string;
  /** 0..1 stroke opacity. */
  opacity?: number;
}

const DEFAULTS: Required<OutlineEffectParams> = {
  width: 1,
  color: 'var(--badge-edge)',
  dash: '',
  blendMode: 'normal',
  opacity: 1,
};

const Outline: EffectModule<OutlineEffectParams> = {
  Component: ({ sampler, boxW, boxH, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const widthVb = cfg.width * Math.max(sx, sy);
    return (
      <path
        d={sampler.bodyPath}
        fill="none"
        stroke={cfg.color}
        strokeWidth={widthVb}
        strokeDasharray={cfg.dash || undefined}
        strokeOpacity={cfg.opacity}
        vectorEffect="non-scaling-stroke"
        style={{ mixBlendMode: cfg.blendMode as never }}
      />
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Outline;
