import type { BaseSampler, EffectModule } from '../bases/types';

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

function buildBitesPath(input: BaseSampler, boxW: number, boxH: number, cfg: Required<BitesEffectParams>, phase: number) {
  const br = Math.max(0.5, cfg.biteRadius);
  const bs = Math.max(2 * br + 0.5, cfg.biteSpacing);
  const irr = Math.max(0, Math.min(cfg.irregularity, 1));
  const sx = 100 / boxW;
  const sy = 100 / boxH;
  const N = Math.max(2, Math.floor(input.totalCss / bs));
  const step = input.totalCss / N;
  const phaseOffset = phase * step;
  let d = '';
  for (let i = 0; i < N; i++) {
    const sCenter = i * step + phaseOffset;
    const localR = br * (1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7));
    const pStart = input.perimeterAt(sCenter - localR);
    const pCenter = input.perimeterAt(sCenter);
    const pEnd = input.perimeterAt(sCenter + localR);
    const apexX = pCenter.x - pCenter.nx * localR * sx;
    const apexY = pCenter.y - pCenter.ny * localR * sy;
    if (i === 0) d = `M ${pStart.x.toFixed(3)} ${pStart.y.toFixed(3)}`;
    else d += ` L ${pStart.x.toFixed(3)} ${pStart.y.toFixed(3)}`;
    d += ` L ${apexX.toFixed(3)} ${apexY.toFixed(3)} L ${pEnd.x.toFixed(3)} ${pEnd.y.toFixed(3)}`;
    const nextStart = (i + 1) * step + phaseOffset - localR;
    const runStart = sCenter + localR;
    const runLen = nextStart - runStart;
    for (let k = 1; k < SAMPLES_BETWEEN_BITES; k++) {
      const p = input.perimeterAt(runStart + (k / SAMPLES_BETWEEN_BITES) * runLen);
      d += ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
    }
  }
  return d + ' Z';
}

const Bites: EffectModule<BitesEffectParams> = {
  transform: (input, { boxW, boxH, params, phase }) => {
    const cfg = { ...DEFAULTS, ...params };
    const bodyPath = buildBitesPath(input, boxW, boxH, cfg, phase);
    return { bodyPath, perimeterAt: input.perimeterAt, totalCss: input.totalCss };
  },
  defaults: DEFAULTS,
};

export default Bites;
