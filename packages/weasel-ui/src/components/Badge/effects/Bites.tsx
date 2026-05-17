import type { EffectModule } from '../bases/types';

export interface BitesEffectParams {
  /** Bite (semicircle notch) radius in CSS px. */
  biteRadius?: number;
  /** Distance between bite centers in CSS px. */
  biteSpacing?: number;
  /** 0..1 deterministic per-bite radius jitter. */
  irregularity?: number;
}

const DEFAULTS: Required<BitesEffectParams> = {
  biteRadius: 3,
  biteSpacing: 8,
  irregularity: 0,
};

const SAMPLES_BETWEEN_BITES = 8;

const Bites: EffectModule<BitesEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params, phase }) => {
    const cfg = { ...DEFAULTS, ...params };
    const br = Math.max(0.5, cfg.biteRadius);
    const bs = Math.max(2 * br + 0.5, cfg.biteSpacing);
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));
    const sx = 100 / boxW;
    const sy = 100 / boxH;

    const N = Math.max(2, Math.floor(sampler.totalCss / bs));
    const step = sampler.totalCss / N;
    const phaseOffset = phase * step;

    let d = '';
    for (let i = 0; i < N; i++) {
      const sCenter = i * step + phaseOffset;
      const localR = br * (1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7));
      const pStart = sampler.perimeterAt(sCenter - localR);
      const pCenter = sampler.perimeterAt(sCenter);
      const pEnd = sampler.perimeterAt(sCenter + localR);
      // Inward bite apex (negative of outward normal).
      const apexX = pCenter.x - pCenter.nx * localR * sx;
      const apexY = pCenter.y - pCenter.ny * localR * sy;

      if (i === 0) d = `M ${pStart.x.toFixed(3)} ${pStart.y.toFixed(3)}`;
      else d += ` L ${pStart.x.toFixed(3)} ${pStart.y.toFixed(3)}`;
      // Two short line segments approximating the arc (kept smooth via two control point fall-throughs).
      d += ` L ${apexX.toFixed(3)} ${apexY.toFixed(3)} L ${pEnd.x.toFixed(3)} ${pEnd.y.toFixed(3)}`;

      // Follow the perimeter between this bite's end and the next bite's start.
      const nextStart = (i + 1) * step + phaseOffset - localR;
      const runStart = sCenter + localR;
      const runLen = nextStart - runStart;
      for (let k = 1; k < SAMPLES_BETWEEN_BITES; k++) {
        const p = sampler.perimeterAt(runStart + (k / SAMPLES_BETWEEN_BITES) * runLen);
        d += ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
      }
    }
    d += ' Z';
    void sx; void sy;
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      </>
    );
  },
  defaults: DEFAULTS,
};

export default Bites;
