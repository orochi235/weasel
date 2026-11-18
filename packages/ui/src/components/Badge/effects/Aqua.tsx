import type { ColorSource } from '@weasel-js/paint';
import { useColorCss } from '@weasel-js/theme/react';
import { useId } from 'react';
import type { EffectModule } from '../bases/types';
import { GlassStrokes } from './glassStrokes';

/**
 * Aqua-glass treatment — composes onto any badge silhouette: a body gradient,
 * a specular gloss clipped to the body, a bezel highlight, and a rim outline.
 * The bezel strokes perimeter segments whose outward normal points up
 * (`ny < 0`) — normal-aware, not bbox-aligned, which is what makes it work on
 * arbitrary silhouettes.
 *
 * For the *truly* translucent look, use this with `variant="outline"` so the
 * badge's own flat fill doesn't paint behind the gradient, and set
 * `backdrop-filter: blur(...)` on the host element via CSS.
 */
/** What an effect of type `aqua` takes as `params`. */
export interface BadgeAquaEffectParams {
  /** Body tint. Defaults to `var(--badge-edge)` so the badge's color drives it. */
  accent?: ColorSource;
  /** Stop opacities along the body gradient (0..1). */
  topAlpha?: number;
  upperAlpha?: number;
  /** Equator Y position in viewBox units (0..100). */
  equator?: number;
  /** Half-width of the transition band around the equator (viewBox units). */
  equatorSpread?: number;
  /** Mix ratios for the bright equator and dark base stops (0..100, % accent). */
  equatorTint?: number;
  baseTint?: number;
  /** Specular gloss params. */
  glossTopAlpha?: number;
  glossMidAlpha?: number;
  /** Y extent the gloss covers, in viewBox units. 50 = upper hemisphere. */
  glossExtent?: number;
  /** Normal-aware bezel highlight. */
  bezelAlpha?: number;
  bezelWidth?: number; // CSS px
  /** Full-perimeter rim. */
  rimAlpha?: number;
  rimWidth?: number;   // CSS px
}

const DEFAULTS: Required<BadgeAquaEffectParams> = {
  accent: { ref: '--badge-edge' },
  topAlpha: 0.45,
  upperAlpha: 0.7,
  equator: 52,
  equatorSpread: 12,
  equatorTint: 95,
  baseTint: 70,
  glossTopAlpha: 0.7,
  glossMidAlpha: 0.18,
  glossExtent: 50,
  bezelAlpha: 0.7,
  bezelWidth: 1,
  rimAlpha: 0.22,
  rimWidth: 1,
};

const Aqua: EffectModule<BadgeAquaEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    const bodyGradId = useId();
    const glossGradId = useId();
    const glossClipId = useId();
    const css = useColorCss();
    if (variant !== 'solid' && variant !== 'subtle' && variant !== 'outline') return null;
    const cfg = { ...DEFAULTS, ...params };
    const accent = css(cfg.accent);

    const equatorLo = Math.max(0, cfg.equator - cfg.equatorSpread);
    const equatorHi = Math.min(100, cfg.equator + cfg.equatorSpread * 1.6);
    const equatorBrightColor = `color-mix(in srgb, ${accent} ${cfg.equatorTint}%, white)`;
    const baseColor = `color-mix(in srgb, ${accent} ${cfg.baseTint}%, black)`;

    return (
      <>
        <defs>
          <linearGradient id={bodyGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: accent, stopOpacity: cfg.topAlpha }} />
            <stop offset={`${equatorLo}%`} style={{ stopColor: accent, stopOpacity: cfg.upperAlpha }} />
            <stop offset={`${cfg.equator}%`} style={{ stopColor: equatorBrightColor, stopOpacity: 1 }} />
            <stop offset={`${equatorHi}%`} style={{ stopColor: accent, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: baseColor, stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id={glossGradId} x1="0%" y1="0%" x2="0%" y2={`${cfg.glossExtent}%`}>
            <stop offset="0%" style={{ stopColor: 'white', stopOpacity: cfg.glossTopAlpha }} />
            <stop offset="60%" style={{ stopColor: 'white', stopOpacity: cfg.glossMidAlpha }} />
            <stop offset="100%" style={{ stopColor: 'white', stopOpacity: 0 }} />
          </linearGradient>
          <clipPath id={glossClipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
        </defs>

        {/* 1. Body — vertical gradient over the silhouette */}
        <path d={sampler.bodyPath} fill={`url(#${bodyGradId})`} style={{ pointerEvents: 'none' }} />

        {/* 2. Gloss — upper region, clipped to silhouette */}
        <rect
          x="0"
          y="0"
          width="100"
          height={cfg.glossExtent}
          fill={`url(#${glossGradId})`}
          clipPath={`url(#${glossClipId})`}
          style={{ pointerEvents: 'none' }}
        />

        {/* 3. Bezel and 4. rim */}
        <GlassStrokes
          sampler={sampler} boxW={boxW} boxH={boxH}
          bezelAlpha={cfg.bezelAlpha} bezelWidth={cfg.bezelWidth} rimAlpha={cfg.rimAlpha} rimWidth={cfg.rimWidth}
        />
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Aqua;
