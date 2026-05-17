import { useId } from 'react';
import type { EffectModule } from '../bases/types';

export interface SunbeamsEffectParams {
  /** Number of beams (parallelograms) cast across the body. */
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
  color?: string;
  /** Drift the beam pattern left/right by N CSS px (lets you slide the "window" over the body). */
  offset?: number;
  /** 0..1 perturbs each beam's width, opacity, and angle slightly with a deterministic
   *  per-beam noise; 0 = perfectly regular. */
  irregularity?: number;
  /** Gradient mask angle in degrees. 0 = left→right, 90 = top→bottom. */
  gradientAngle?: number;
  /** Position along the gradient axis (0..1) where the mask is fully opaque (beams visible). */
  gradientStart?: number;
  /** Position along the gradient axis (0..1) where the mask is fully transparent (beams faded out). */
  gradientEnd?: number;
}

const DEFAULTS: Required<SunbeamsEffectParams> = {
  count: 3,
  width: 18,
  gap: 8,
  angle: 28,
  opacity: 0.18,
  color: '#ffffff',
  offset: 0,
  irregularity: 0,
  gradientAngle: 90,
  gradientStart: 0,
  gradientEnd: 1,
};

const Sunbeams: EffectModule<SunbeamsEffectParams> = {
  Component: ({ sampler, boxW, boxH, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const clipId = useId();
    const maskId = useId();
    const gradId = useId();
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));

    // Per-beam pseudo-random multipliers (deterministic by index).
    const widthMult = (i: number) => 1 + irr * 0.45 * Math.sin(i * 1.73 + 0.7);
    const opacityMult = (i: number) => 1 + irr * 0.5 * Math.sin(i * 2.31 + 1.3);
    const angleJitter = (i: number) => irr * 8 * Math.sin(i * 3.07 + 0.4); // degrees

    // Total horizontal span (centered on x=50). We compute using nominal widths so the
    // pattern's centering is stable as irregularity moves individual beam widths.
    const nominalWidthVb = cfg.width * sx;
    const gapVb = cfg.gap * sx;
    const offsetVb = cfg.offset * sx;
    const totalWidth = cfg.count * nominalWidthVb + (cfg.count - 1) * gapVb;
    let cursorX = 50 - totalWidth / 2 + offsetVb;
    const yTop = -50;
    const yBot = 150;

    const beams: { points: string; opacity: number }[] = [];
    for (let i = 0; i < cfg.count; i++) {
      const beamWidthVb = nominalWidthVb * widthMult(i);
      const x1 = cursorX;
      const x2 = cursorX + beamWidthVb;
      const tan = Math.tan(((cfg.angle + angleJitter(i)) * Math.PI) / 180);
      const horizPerVb = tan * (sx / sy);
      const halfShear = horizPerVb * (yBot - yTop) / 2;
      const pts = [
        [x1 + halfShear, yTop],
        [x2 + halfShear, yTop],
        [x2 - halfShear, yBot],
        [x1 - halfShear, yBot],
      ];
      beams.push({
        points: pts.map(([px, py]) => `${px.toFixed(3)},${py.toFixed(3)}`).join(' '),
        opacity: Math.max(0, Math.min(cfg.opacity * opacityMult(i), 1)),
      });
      cursorX += nominalWidthVb + gapVb;
    }

    // Gradient mask geometry: define a linear gradient from one edge of the viewBox to the
    // other along `gradientAngle`. Position the start/end stops along that 0..1 axis.
    const ga = (cfg.gradientAngle * Math.PI) / 180;
    const cosA = Math.cos(ga), sinA = Math.sin(ga);
    // Vector from centre to edge along the axis. Pick a long-enough span so 0..1 covers
    // the badge fully.
    const span = 100; // viewBox units along the axis from (50-50cos, 50-50sin) to (50+50cos, 50+50sin)
    const x1g = 50 - cosA * span / 2;
    const y1g = 50 - sinA * span / 2;
    const x2g = 50 + cosA * span / 2;
    const y2g = 50 + sinA * span / 2;

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
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect x="0" y="0" width="100" height="100" fill={`url(#${gradId})`} />
          </mask>
        </defs>
        <g clipPath={`url(#${clipId})`} mask={`url(#${maskId})`}>
          {beams.map((b, i) => (
            <polygon key={i} points={b.points} fill={cfg.color} opacity={b.opacity} />
          ))}
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Sunbeams;
