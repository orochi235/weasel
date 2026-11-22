import { cssColorLiteral, type ColorSource } from '@weasel-js/paint';
import { useColorCss } from '@weasel-js/theme/react';
import { useId } from 'react';
import type { EffectModule } from '../bases/types';
import { DEG_TO_RAD, trimNumber } from '@weasel-js/geom';
import { outlineRegion } from '../composeOutline';
import { repeatCount, finiteParams } from '../shapes/params';

/** What an effect of type `sunbeams` takes as `params`. */
export interface BadgeSunbeamsEffectParams {
  /** Number of beams (parallelograms) cast across the body, a whole number up to 256. */
  count?: number;
  /** Beam width in CSS px (measured horizontally before the skew). */
  width?: number;
  /** Gap between adjacent beams in CSS px. */
  gap?: number;
  /** Skew angle in degrees. 0 = vertical bars; positive = leaning right. */
  angle?: number;
  /** 0..1 lightness opacity. */
  opacity?: number;
  /** Beam color. Defaults to white. */
  color?: ColorSource;
  /** Drift the beam pattern left/right by N CSS px (lets you slide the "window" over the body). */
  offset?: number;
  /** 0..1 perturbs each beam's width, opacity, and angle slightly with a deterministic
   *  per-beam noise; 0 = perfectly regular. */
  irregularity?: number;
  /** Gradient mask angle in degrees, on screen as `angle` is. 0 = left→right, 90 = top→bottom. */
  gradientAngle?: number;
  /** Position along the gradient axis (0..1) where the mask is fully opaque (beams visible). */
  gradientStart?: number;
  /** Position along the gradient axis (0..1) where the mask is fully transparent (beams faded out). */
  gradientEnd?: number;
}

const DEFAULTS: Required<BadgeSunbeamsEffectParams> = {
  count: 3,
  width: 18,
  gap: 8,
  angle: 28,
  opacity: 0.18,
  color: cssColorLiteral('#ffffff'),
  offset: 0,
  irregularity: 0,
  gradientAngle: 90,
  gradientStart: 0,
  gradientEnd: 1,
};

const Sunbeams: EffectModule<BadgeSunbeamsEffectParams> = {
  Component: ({ sampler, boxW, boxH, params }) => {
    const cfg = finiteParams({ ...DEFAULTS, ...params }, DEFAULTS, ['count']);
    const css = useColorCss();
    const clipId = useId();
    const maskId = useId();
    const gradId = useId();
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));
    const count = repeatCount(cfg.count, 0);

    // Per-beam pseudo-random multipliers (deterministic by index).
    const widthMult = (i: number) => 1 + irr * 0.45 * Math.sin(i * 1.73 + 0.7);
    const opacityMult = (i: number) => 1 + irr * 0.5 * Math.sin(i * 2.31 + 1.3);
    const angleJitter = (i: number) => irr * 8 * Math.sin(i * 3.07 + 0.4); // degrees

    // Total horizontal span (centered on x=50). We compute using nominal widths so the
    // pattern's centering is stable as irregularity moves individual beam widths.
    const nominalWidthVb = cfg.width * sx;
    const gapVb = cfg.gap * sx;
    const offsetVb = cfg.offset * sx;
    const totalWidth = count * nominalWidthVb + (count - 1) * gapVb;
    let cursorX = 50 - totalWidth / 2 + offsetVb;
    const region = outlineRegion(sampler, 0);
    // Beams stay centered on y = 50 and run past the outline's farther edge from it.
    const reach = Math.max(100, 50 - region.y, region.y + region.height - 50);
    const yTop = 50 - reach;
    const yBot = 50 + reach;

    const beams: { points: string; opacity: number }[] = [];
    for (let i = 0; i < count; i++) {
      const beamWidthVb = nominalWidthVb * widthMult(i);
      const x1 = cursorX;
      const x2 = cursorX + beamWidthVb;
      const tan = Math.tan((cfg.angle + angleJitter(i)) * DEG_TO_RAD);
      const horizPerVb = tan * (sx / sy);
      const halfShear = horizPerVb * (yBot - yTop) / 2;
      const pts = [
        [x1 + halfShear, yTop],
        [x2 + halfShear, yTop],
        [x2 - halfShear, yBot],
        [x1 - halfShear, yBot],
      ];
      beams.push({
        points: pts.map(([px, py]) => `${trimNumber(px, 3)},${trimNumber(py, 3)}`).join(' '),
        opacity: Math.max(0, Math.min(cfg.opacity * opacityMult(i), 1)),
      });
      cursorX += nominalWidthVb + gapVb;
    }

    // The fade runs along `gradientAngle` on screen, with 0 and 1 on the outline region's farthest
    // corners. The viewBox stretches to the box, so the screen direction (cos, sin) is laid in it as
    // (cos * boxW, sin * boxH), which keeps the isolines square to it once stretched.
    const ga = cfg.gradientAngle * DEG_TO_RAD;
    const wx = Math.cos(ga) * boxW, wy = Math.sin(ga) * boxH;
    const wl = Math.hypot(wx, wy) || 1;
    const ux = wx / wl, uy = wy / wl;
    const along = [region.x, region.x + region.width].flatMap((x) => [region.y, region.y + region.height].map((y) => x * ux + y * uy));
    const tMin = Math.min(...along), tMax = Math.max(...along);
    const x1g = ux * tMin, y1g = uy * tMin;
    const x2g = ux * tMax, y2g = uy * tMax;

    const gs = Math.max(0, Math.min(cfg.gradientStart, 1));
    const ge = Math.max(0, Math.min(cfg.gradientEnd, 1));
    // Build stops so the gradient is white (opaque) at `gs` and black (transparent) at `ge`,
    // working whether gs < ge or vice versa.
    const stops = gs <= ge
      ? [
          { offset: 0, color: '#fff' },
          { offset: gs, color: '#fff' },
          { offset: ge, color: '#000' },
          { offset: 1, color: '#000' },
        ]
      : [
          { offset: 0, color: '#000' },
          { offset: ge, color: '#000' },
          { offset: gs, color: '#fff' },
          { offset: 1, color: '#fff' },
        ];

    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
          <linearGradient id={gradId} x1={x1g} y1={y1g} x2={x2g} y2={y2g} gradientUnits="userSpaceOnUse">
            {stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
          </linearGradient>
          <mask id={maskId} maskUnits="userSpaceOnUse" {...region}>
            <rect {...region} fill={`url(#${gradId})`} />
          </mask>
        </defs>
        <g clipPath={`url(#${clipId})`} mask={`url(#${maskId})`}>
          {beams.map((b, i) => (
            <polygon key={i} points={b.points} fill={css(cfg.color)} opacity={b.opacity} />
          ))}
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Sunbeams;
