import type { ColorSource } from '@weasel-js/paint';
import { useColorCss } from '@weasel-js/theme/react';
import type { EffectModule } from '../bases/types';

/** What an effect of type `outline` takes as `params`. */
export interface BadgeOutlineEffectParams {
  /** Stroke width in CSS px. */
  width?: number;
  /** Stroke color. */
  color?: ColorSource;
  /** Optional SVG dasharray (e.g. "4 2"). */
  dash?: string;
  /** CSS mix-blend-mode: 'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
   *  'difference', etc. Useful when the outline color should react to whatever's behind it. */
  blendMode?: string;
  /** 0..1 stroke opacity. */
  opacity?: number;
}

const DEFAULTS: Required<BadgeOutlineEffectParams> = {
  width: 1,
  color: { ref: '--badge-edge' },
  dash: '',
  blendMode: 'normal',
  opacity: 1,
};

const Outline: EffectModule<BadgeOutlineEffectParams> = {
  Component: ({ sampler, boxW, boxH, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const css = useColorCss();
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const widthVb = cfg.width * Math.max(sx, sy);
    return (
      <path
        d={sampler.bodyPath}
        fill="none"
        stroke={css(cfg.color)}
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
