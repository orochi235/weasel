import type { EffectModule } from '../bases/types';

export interface SpikesEffectParams {
  /** Number of spikes distributed evenly around the perimeter (by CSS arc length). */
  count?: number;
  /** Spike length in CSS px. */
  length?: number;
  /** Spike base width in CSS px. */
  baseWidth?: number;
  /** Optional length multiplier when the spike's outward normal is dominantly vertical (|ny| > |nx|). */
  vertScale?: number;
  /** Optional length multiplier when the spike's outward normal is dominantly horizontal. */
  horzScale?: number;
  /** Optional length multiplier for spikes whose normal is neither cleanly vertical nor horizontal. */
  diagonalScale?: number;
  /** 0..1 deterministic per-spike length jitter. */
  irregularity?: number;
}

const DEFAULTS: Required<SpikesEffectParams> = {
  count: 44,
  length: 8,
  baseWidth: 3,
  vertScale: 1.4,
  horzScale: 1,
  diagonalScale: 0.5,
  irregularity: 0,
};

const Spikes: EffectModule<SpikesEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params, phase }) => {
    const cfg = { ...DEFAULTS, ...params };
    const N = Math.max(3, Math.floor(cfg.count));
    const step = sampler.totalCss / N;
    // baseWidth in CSS → arc length step (chord ≈ arc for small widths).
    const baseHalf = Math.max(0.1, Math.min(step / 2 - 0.05, cfg.baseWidth / 2));
    const phaseOffset = phase * step;
    let d = '';
    for (let i = 0; i < N; i++) {
      const sc = i * step + phaseOffset;
      const pStart = sampler.perimeterAt(sc - baseHalf);
      const pCenter = sampler.perimeterAt(sc);
      const pEnd = sampler.perimeterAt(sc + baseHalf);
      const nxAbs = Math.abs(pCenter.nx);
      const nyAbs = Math.abs(pCenter.ny);
      const onDiagonal = nxAbs > 0.05 && nyAbs > 0.05;
      const dirX = onDiagonal ? Math.sign(pCenter.nx) / Math.SQRT2 : pCenter.nx;
      const dirY = onDiagonal ? Math.sign(pCenter.ny) / Math.SQRT2 : pCenter.ny;
      const scale = onDiagonal ? cfg.diagonalScale : (nyAbs > nxAbs ? cfg.vertScale : cfg.horzScale);
      const irrMult = 1 + cfg.irregularity * 0.5 * Math.sin(i * 1.73 + 0.7);
      const lenCss = Math.max(0, cfg.length * scale * irrMult);
      const tipX = pCenter.x + dirX * lenCss * (100 / boxW);
      const tipY = pCenter.y + dirY * lenCss * (100 / boxH);
      d += (i === 0 ? `M ${pStart.x.toFixed(2)} ${pStart.y.toFixed(2)}` : ` L ${pStart.x.toFixed(2)} ${pStart.y.toFixed(2)}`);
      d += ` L ${tipX.toFixed(2)} ${tipY.toFixed(2)}`;
      d += ` L ${pEnd.x.toFixed(2)} ${pEnd.y.toFixed(2)}`;
      // Follow the perimeter from this spike's end to the next spike's start.
      const samples = 6;
      const sEnd = sc + baseHalf;
      const nextStart = (i + 1) * step + phaseOffset - baseHalf;
      for (let k = 1; k < samples; k++) {
        const sStep = sEnd + (k / samples) * (nextStart - sEnd);
        const p = sampler.perimeterAt(sStep);
        d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      }
    }
    d += ' Z';
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      </>
    );
  },
  defaults: DEFAULTS,
};

export default Spikes;
