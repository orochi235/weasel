import type { BaseSampler, EffectModule } from '../bases/types';

export interface ScallopsEffectParams {
  /** Scallop radius in CSS px. */
  scallopRadius?: number;
  /** Spacing between scallop centers in CSS px. */
  scallopSpacing?: number;
  /** 0..1 deterministic per-scallop radius jitter. */
  irregularity?: number;
}

const DEFAULTS: Required<ScallopsEffectParams> = {
  scallopRadius: 4,
  scallopSpacing: 10,
  irregularity: 0,
};

const SAMPLES_PER_BUMP = 12;

function buildScallopsPath(input: BaseSampler, boxW: number, boxH: number, cfg: Required<ScallopsEffectParams>, phase: number) {
  const sr = Math.max(0.5, cfg.scallopRadius);
  const ss = Math.max(2 * sr + 0.5, cfg.scallopSpacing);
  const irr = Math.max(0, Math.min(cfg.irregularity, 1));
  const sx = 100 / boxW;
  const sy = 100 / boxH;
  const N = Math.max(2, Math.floor(input.totalCss / ss));
  const step = input.totalCss / N;
  const phaseOffset = phase * step;
  let d = '';
  let started = false;
  for (let i = 0; i < N; i++) {
    const sCenter = i * step + phaseOffset;
    const localR = sr * (1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7));
    const sStart = sCenter - localR;
    const sEnd = sCenter + localR;
    for (let k = (started ? 1 : 0); k <= SAMPLES_PER_BUMP; k++) {
      const t = k / SAMPLES_PER_BUMP;
      const s = sStart + t * (sEnd - sStart);
      const pt = input.perimeterAt(s);
      // Half-circle outward — peak displacement at t=0.5 equals localR.
      const disp = localR * Math.sin(Math.PI * t);
      const x = pt.x + pt.nx * disp * sx;
      const y = pt.y + pt.ny * disp * sy;
      if (!started) { d = `M ${x.toFixed(3)} ${y.toFixed(3)}`; started = true; }
      else d += ` L ${x.toFixed(3)} ${y.toFixed(3)}`;
    }
    // Body run from this scallop's end to next scallop's start (follows the base perimeter).
    const nextStart = (i + 1) * step + phaseOffset - localR;
    const runLen = nextStart - sEnd;
    for (let k = 1; k < SAMPLES_PER_BUMP; k++) {
      const p = input.perimeterAt(sEnd + (k / SAMPLES_PER_BUMP) * runLen);
      d += ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
    }
  }
  return d + ' Z';
}

const Scallops: EffectModule<ScallopsEffectParams> = {
  transform: (input, { boxW, boxH, params, phase }) => {
    const cfg = { ...DEFAULTS, ...params };
    const bodyPath = buildScallopsPath(input, boxW, boxH, cfg, phase);
    return { bodyPath, perimeterAt: input.perimeterAt, totalCss: input.totalCss };
  },
  defaults: DEFAULTS,
};

export default Scallops;
