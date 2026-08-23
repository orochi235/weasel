import { useId } from 'react';
import type { EffectModule } from '../bases/types';

/**
 * Aqua-glass treatment — composes onto any badge silhouette by walking the
 * sampler's perimeter and painting four layered sub-effects in one pass:
 *
 *  1. Body gradient    — vertical tint that runs translucent-top through a
 *                        bright equator band into a dark base.
 *  2. Specular gloss   — upper-hemisphere white-fade clipped to the body.
 *  3. Bezel highlight  — bright stroke along perimeter segments whose
 *                        outward normal points up (`ny < 0`). On a pill that's
 *                        the upper half; on a hex it's the three top edges;
 *                        on a starburst it's the upward tips. Normal-aware,
 *                        not bbox-aligned, which is what makes it work on
 *                        arbitrary silhouettes.
 *  4. Rim outline      — faint dark stroke along the full perimeter.
 *
 * For the *truly* translucent look (with backdrop-filter blur reading the
 * surface behind the badge), use this with `variant="outline"` so the badge's
 * own flat fill doesn't paint behind the gradient, and set
 * `backdrop-filter: blur(...)` on the host element via CSS.
 */
export interface AquaEffectParams {
  /** Body tint. Defaults to `var(--badge-edge)` so the badge's tone drives it. */
  accent?: string;
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

const DEFAULTS: Required<AquaEffectParams> = {
  accent: 'var(--badge-edge)',
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

const BEZEL_SAMPLES = 240;

const Aqua: EffectModule<AquaEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    const bodyGradId = useId();
    const glossGradId = useId();
    const glossClipId = useId();
    if (variant !== 'solid' && variant !== 'subtle' && variant !== 'outline') return null;
    const cfg = { ...DEFAULTS, ...params };

    // Walk the perimeter and collect contiguous runs where the outward normal
    // points up (ny < 0) — those segments will get the bezel highlight.
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
    // Wraparound: if first sample and last sample are both "up", merge the
    // tail into the head so the bezel renders as one stroke across s=0.
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

    // Stroke widths in CSS px → viewBox units. The badge SVG is 100×100 with
    // preserveAspectRatio="none", so use the larger inverse-scale to keep
    // the stroke from getting too thin in either axis.
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const widthScale = Math.max(sx, sy);
    const bezelWidthVb = cfg.bezelWidth * widthScale;
    const rimWidthVb = cfg.rimWidth * widthScale;

    const equatorLo = Math.max(0, cfg.equator - cfg.equatorSpread);
    const equatorHi = Math.min(100, cfg.equator + cfg.equatorSpread * 1.6);
    const equatorBrightColor = `color-mix(in srgb, ${cfg.accent} ${cfg.equatorTint}%, white)`;
    const baseColor = `color-mix(in srgb, ${cfg.accent} ${cfg.baseTint}%, black)`;

    return (
      <>
        <defs>
          <linearGradient id={bodyGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: cfg.accent, stopOpacity: cfg.topAlpha }} />
            <stop offset={`${equatorLo}%`} style={{ stopColor: cfg.accent, stopOpacity: cfg.upperAlpha }} />
            <stop offset={`${cfg.equator}%`} style={{ stopColor: equatorBrightColor, stopOpacity: 1 }} />
            <stop offset={`${equatorHi}%`} style={{ stopColor: cfg.accent, stopOpacity: 1 }} />
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

        {/* 3. Bezel — stroke segments where normal points up */}
        {bezelPaths.map((d, i) => (
          <path
            key={`bz-${i}`}
            d={d}
            fill="none"
            stroke="white"
            strokeOpacity={cfg.bezelAlpha}
            strokeWidth={bezelWidthVb}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: 'none' }}
          />
        ))}

        {/* 4. Rim — full perimeter at low opacity */}
        <path
          d={sampler.bodyPath}
          fill="none"
          stroke="black"
          strokeOpacity={cfg.rimAlpha}
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

export default Aqua;
