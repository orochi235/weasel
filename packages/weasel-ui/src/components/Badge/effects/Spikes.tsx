import type { BaseSampler, EffectModule } from '../bases/types';

export interface SpikesEffectParams {
  count?: number;
  length?: number;
  baseWidth?: number;
  vertScale?: number;
  horzScale?: number;
  diagonalScale?: number;
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

function buildSpikesPath(input: BaseSampler, boxW: number, boxH: number, cfg: Required<SpikesEffectParams>, phase: number) {
  const N = Math.max(3, Math.floor(cfg.count));
  const step = input.totalCss / N;
  const baseHalf = Math.max(0.1, Math.min(step / 2 - 0.05, cfg.baseWidth / 2));
  const phaseOffset = phase * step;
  let d = '';
  for (let i = 0; i < N; i++) {
    const sc = i * step + phaseOffset;
    const pStart = input.perimeterAt(sc - baseHalf);
    const pCenter = input.perimeterAt(sc);
    const pEnd = input.perimeterAt(sc + baseHalf);
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
    const samples = 6;
    const sEnd = sc + baseHalf;
    const nextStart = (i + 1) * step + phaseOffset - baseHalf;
    for (let k = 1; k < samples; k++) {
      const sStep = sEnd + (k / samples) * (nextStart - sEnd);
      const p = input.perimeterAt(sStep);
      d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
  }
  return d + ' Z';
}

const Spikes: EffectModule<SpikesEffectParams> = {
  transform: (input, { boxW, boxH, params, phase }) => {
    const cfg = { ...DEFAULTS, ...params };
    const bodyPath = buildSpikesPath(input, boxW, boxH, cfg, phase);
    return { bodyPath, perimeterAt: input.perimeterAt, totalCss: input.totalCss };
  },
  defaults: DEFAULTS,
};

export default Spikes;
