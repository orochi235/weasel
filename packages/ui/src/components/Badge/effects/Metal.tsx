import { cssColorLiteral, type ColorSource } from '@weasel-js/paint';
import { useColorCss } from '@weasel-js/theme/react';
import { useId } from 'react';
import type { EffectModule } from '../bases/types';

/**
 * Metal — opaque cousin of the Aqua treatment, with the same sub-passes. One
 * `specularity` knob multiplies the equator brightness, gloss alpha, bezel
 * alpha, and rim alpha — so one slider moves the whole surface along a
 * matte-to-mirror axis.
 */
/** What an effect of type `metal` takes as `params`. */
export interface BadgeMetalEffectParams {
  /** Base metal color. Defaults to a neutral steel; pass e.g. `'#c8a657'` for brass. */
  accent?: ColorSource;
  /** 0 = matte, 1 = mirror. Multiplies the brightness of the equator, gloss,
   *  bezel, and rim simultaneously. */
  specularity?: number;
  /** Equator Y position (viewBox units, 0..100). */
  equator?: number;
  /** Half-width of the bright equator band. Smaller = sharper specular. */
  equatorSpread?: number;
  /** How dark the upper and lower extremes are (% accent vs black, 0..100). */
  topDarkness?: number;
  baseDarkness?: number;
  /** Gloss params. */
  glossExtent?: number;
  /** Per-zone alpha *baselines* — scaled by `specularity`. */
  glossAlphaTop?: number;
  bezelAlpha?: number;
  bezelWidth?: number;   // CSS px
  rimAlpha?: number;
  rimWidth?: number;     // CSS px
}

const DEFAULTS: Required<BadgeMetalEffectParams> = {
  accent: cssColorLiteral('#aab3bd'), // neutral steel
  specularity: 0.6,
  equator: 50,
  equatorSpread: 8,
  topDarkness: 55,
  baseDarkness: 35,
  glossExtent: 50,
  glossAlphaTop: 0.55,
  bezelAlpha: 0.85,
  bezelWidth: 1,
  rimAlpha: 0.35,
  rimWidth: 1,
};

const BEZEL_SAMPLES = 240;

const Metal: EffectModule<BadgeMetalEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    const bodyGradId = useId();
    const glossGradId = useId();
    const glossClipId = useId();
    const css = useColorCss();
    if (variant !== 'solid' && variant !== 'subtle' && variant !== 'outline') return null;
    const cfg = { ...DEFAULTS, ...params };
    const accent = css(cfg.accent);
    const spec = Math.max(0, Math.min(cfg.specularity, 1));

    // --- Bezel sample walk (same as Aqua: runs where ny < 0). ---
    const total = sampler.totalCss;
    type Pt = { x: number; y: number };
    const runs: Pt[][] = [];
    let cur: Pt[] | null = null;
    for (let i = 0; i < BEZEL_SAMPLES; i++) {
      const s = (i / BEZEL_SAMPLES) * total;
      const pt = sampler.perimeterAt(s);
      if (pt.ny < 0) {
        if (!cur) {
          cur = [];
          runs.push(cur);
        }
        cur.push({ x: pt.x, y: pt.y });
      } else {
        cur = null;
      }
    }
    if (runs.length > 1) {
      const firstSample = sampler.perimeterAt(0);
      const lastSample = sampler.perimeterAt(((BEZEL_SAMPLES - 1) / BEZEL_SAMPLES) * total);
      if (firstSample.ny < 0 && lastSample.ny < 0) {
        const head = runs.shift()!;
        runs[runs.length - 1].push(...head);
      }
    }
    const bezelPaths: string[] = [];
    for (const run of runs) {
      if (run.length < 2) continue;
      let d = `M ${run[0].x.toFixed(3)} ${run[0].y.toFixed(3)}`;
      for (let i = 1; i < run.length; i++) {
        d += ` L ${run[i].x.toFixed(3)} ${run[i].y.toFixed(3)}`;
      }
      bezelPaths.push(d);
    }

    const widthScale = Math.max(100 / boxW, 100 / boxH);
    const bezelWidthVb = cfg.bezelWidth * widthScale;
    const rimWidthVb = cfg.rimWidth * widthScale;

    const equatorLo = Math.max(0, cfg.equator - cfg.equatorSpread);
    const equatorHi = Math.min(100, cfg.equator + cfg.equatorSpread);
    // At spec=0 the equator is just the accent; at spec=1 it's almost white.
    const equatorWhiteMix = 100 - Math.round(spec * 85);
    const equatorColor = `color-mix(in srgb, ${accent} ${equatorWhiteMix}%, white)`;
    const topDarkColor = `color-mix(in srgb, ${accent} ${cfg.topDarkness}%, black)`;
    const baseDarkColor = `color-mix(in srgb, ${accent} ${cfg.baseDarkness}%, black)`;
    // Bright stops on either side of the peak collapse toward the peak as
    // specularity rises, sharpening the highlight.
    const upperBrightMix = 100 - Math.round(spec * 50);
    const lowerBrightMix = 100 - Math.round(spec * 30);
    const upperBrightColor = `color-mix(in srgb, ${accent} ${upperBrightMix}%, white)`;
    const lowerBrightColor = `color-mix(in srgb, ${accent} ${lowerBrightMix}%, white)`;

    const glossAlpha = cfg.glossAlphaTop * spec;
    const bezelAlpha = cfg.bezelAlpha * (0.4 + 0.6 * spec);
    const rimAlpha = cfg.rimAlpha * (0.6 + 0.4 * spec);

    return (
      <>
        <defs>
          <linearGradient id={bodyGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: topDarkColor }} />
            <stop offset={`${equatorLo}%`} style={{ stopColor: upperBrightColor }} />
            <stop offset={`${cfg.equator}%`} style={{ stopColor: equatorColor }} />
            <stop offset={`${equatorHi}%`} style={{ stopColor: lowerBrightColor }} />
            <stop offset="100%" style={{ stopColor: baseDarkColor }} />
          </linearGradient>
          <linearGradient id={glossGradId} x1="0%" y1="0%" x2="0%" y2={`${cfg.glossExtent}%`}>
            <stop offset="0%" style={{ stopColor: 'white', stopOpacity: glossAlpha }} />
            <stop offset="100%" style={{ stopColor: 'white', stopOpacity: 0 }} />
          </linearGradient>
          <clipPath id={glossClipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
        </defs>

        <path d={sampler.bodyPath} fill={`url(#${bodyGradId})`} style={{ pointerEvents: 'none' }} />

        {glossAlpha > 0 && (
          <rect
            x="0"
            y="0"
            width="100"
            height={cfg.glossExtent}
            fill={`url(#${glossGradId})`}
            clipPath={`url(#${glossClipId})`}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {bezelPaths.map((d, i) => (
          <path
            key={`bz-${i}`}
            d={d}
            fill="none"
            stroke="white"
            strokeOpacity={bezelAlpha}
            strokeWidth={bezelWidthVb}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: 'none' }}
          />
        ))}

        <path
          d={sampler.bodyPath}
          fill="none"
          stroke="black"
          strokeOpacity={rimAlpha}
          strokeWidth={rimWidthVb}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Metal;
