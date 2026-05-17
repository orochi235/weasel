import type { ShapeModule } from '../types';

export interface CloudParams {
  bumpWidth?: number;
  puffiness?: number;
  padding?: number;
  roundness?: number;
  irregularity?: number;
}

const DEFAULTS: Required<CloudParams> = {
  bumpWidth: 24,
  puffiness: 14,
  padding: 18,
  roundness: 0,
  irregularity: 0,
};

interface PtNormal { x: number; y: number; nx: number; ny: number }

function perimeterAt(s: number, p: number, rx: number, ry: number, ew: number, eh: number, arcLen: number, total: number): PtNormal {
  s = ((s % total) + total) % total;
  const x0 = p, y0 = p, x1 = 100 - p, y1 = 100 - p;
  if (s < ew) return { x: x0 + rx + s, y: y0, nx: 0, ny: -1 };
  s -= ew;
  if (s < arcLen) {
    const a = -Math.PI / 2 + (s / arcLen) * (Math.PI / 2);
    return { x: (x1 - rx) + rx * Math.cos(a), y: (y0 + ry) + ry * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
  }
  s -= arcLen;
  if (s < eh) return { x: x1, y: y0 + ry + s, nx: 1, ny: 0 };
  s -= eh;
  if (s < arcLen) {
    const a = (s / arcLen) * (Math.PI / 2);
    return { x: (x1 - rx) + rx * Math.cos(a), y: (y1 - ry) + ry * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
  }
  s -= arcLen;
  if (s < ew) return { x: x1 - rx - s, y: y1, nx: 0, ny: 1 };
  s -= ew;
  if (s < arcLen) {
    const a = Math.PI / 2 + (s / arcLen) * (Math.PI / 2);
    return { x: (x0 + rx) + rx * Math.cos(a), y: (y1 - ry) + ry * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
  }
  s -= arcLen;
  if (s < eh) return { x: x0, y: y1 - ry - s, nx: -1, ny: 0 };
  s -= eh;
  const a = Math.PI + (s / arcLen) * (Math.PI / 2);
  return { x: (x0 + rx) + rx * Math.cos(a), y: (y0 + ry) + ry * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
}

function cloudPath(bumpWidth: number, puffiness: number, padding: number, roundness: number, irregularity: number, phase: number) {
  // padding: higher value = bigger body (more inner room). Internal `p` is the bump margin from viewBox edge.
  const inner = Math.max(0, Math.min(padding, 40));
  const p = 40 - inner;
  const innerW = 100 - 2 * p;
  const innerH = 100 - 2 * p;
  const rnd = Math.max(0, Math.min(roundness, 1));
  const rx = rnd * (innerW / 2);
  const ry = rnd * (innerH / 2);
  const ew = Math.max(0, innerW - 2 * rx);
  const eh = Math.max(0, innerH - 2 * ry);
  const denom = rx + ry || 1;
  const hh = ((rx - ry) / denom) ** 2;
  const arcLen = (rx > 0 || ry > 0)
    ? (Math.PI * denom * (1 + 3 * hh / (10 + Math.sqrt(4 - 3 * hh)))) / 4
    : 0;
  const total = 2 * ew + 2 * eh + 4 * arcLen;
  const N = Math.max(2, Math.round(total / Math.max(6, bumpWidth)));
  const step = total / N;
  const py = Math.max(0.5, puffiness);
  const samplesPerBump = 18;

  let d = '';
  let firstWritten = false;
  const phaseOffset = phase * step;
  const irr = Math.max(0, Math.min(irregularity, 1));
  for (let i = 0; i < N; i++) {
    const sBumpStart = i * step + phaseOffset;
    // Deterministic per-bump puffiness multiplier in roughly [1 - irr*0.55, 1 + irr*0.55].
    const localPy = py * (1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7));
    for (let k = (firstWritten ? 1 : 0); k <= samplesPerBump; k++) {
      const t = k / samplesPerBump;
      const sKey = sBumpStart + t * step;
      const pt = perimeterAt(sKey, p, rx, ry, ew, eh, arcLen, total);
      const disp = localPy * Math.sin(Math.PI * t);
      const x = pt.x + pt.nx * disp;
      const y = pt.y + pt.ny * disp;
      if (!firstWritten) {
        d = `M ${x.toFixed(3)} ${y.toFixed(3)}`;
        firstWritten = true;
      } else {
        d += ` L ${x.toFixed(3)} ${y.toFixed(3)}`;
      }
    }
  }
  return d + ' Z';
}

const Cloud: ShapeModule<CloudParams> = {
  Component: ({ variant, focused, params, phase }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = cloudPath(cfg.bumpWidth, cfg.puffiness, cfg.padding, cfg.roundness, cfg.irregularity, phase);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && (
          <path className="badge-focus" d={d} transform="translate(50 50) scale(1.04) translate(-50 -50)" />
        )}
      </>
    );
  },
  insets: { top: 4, right: 4, bottom: 4, left: 4 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Cloud;
