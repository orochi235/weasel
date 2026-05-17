import type { EffectModule } from '../bases/types';

export interface PuffsEffectParams {
  /** Approximate CSS px width of each puff along the perimeter. */
  bumpWidth?: number;
  /** Outward bump apex distance in CSS px. */
  puffiness?: number;
  /** 0..1 deterministic per-bump puffiness jitter. */
  irregularity?: number;
}

const DEFAULTS: Required<PuffsEffectParams> = {
  bumpWidth: 18,
  puffiness: 10,
  irregularity: 0,
};

const SAMPLES_PER_BUMP = 18;

const Puffs: EffectModule<PuffsEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params, phase }) => {
    const cfg = { ...DEFAULTS, ...params };
    const N = Math.max(2, Math.round(sampler.totalCss / Math.max(6, cfg.bumpWidth)));
    const step = sampler.totalCss / N;
    const py = Math.max(0.5, cfg.puffiness);
    const phaseOffset = phase * step;
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));
    const sx = 100 / boxW;
    const sy = 100 / boxH;

    let d = '';
    let started = false;
    for (let i = 0; i < N; i++) {
      const sStart = i * step + phaseOffset;
      const localPy = py * (1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7));
      for (let k = (started ? 1 : 0); k <= SAMPLES_PER_BUMP; k++) {
        const t = k / SAMPLES_PER_BUMP;
        const s = sStart + t * step;
        const pt = sampler.perimeterAt(s);
        const disp = localPy * Math.sin(Math.PI * t);
        const x = pt.x + pt.nx * disp * sx;
        const y = pt.y + pt.ny * disp * sy;
        if (!started) {
          d = `M ${x.toFixed(3)} ${y.toFixed(3)}`;
          started = true;
        } else {
          d += ` L ${x.toFixed(3)} ${y.toFixed(3)}`;
        }
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

export default Puffs;
