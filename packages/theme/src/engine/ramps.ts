import { DEFAULT_CONSTRAINTS, generate, type Anchor, type Constraints } from './color/generate';
import { toHex, toLch } from './color/oklch';

export interface LightnessParams {
  readonly steps: readonly string[];
  readonly lightness: readonly [number, number];
  readonly curve: number;
  readonly hue: number;
  readonly peak: number;
  /** Lifts the first step's chroma off zero, as `darkBias` lifts the last. Default 0. */
  readonly lightBias?: number;
  readonly darkBias: number;
  readonly anchor?: Readonly<Record<string, string>>;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const envelope = (t: number, lightBias: number, darkBias: number) => Math.sin(Math.PI * t) + lightBias * (1 - t) + darkBias * t;

function envelopeMax(lightBias: number, darkBias: number): number {
  let max = 0;
  for (let i = 0; i <= 1000; i += 1) max = Math.max(max, envelope(i / 1000, lightBias, darkBias));
  return max;
}

/**
 * Step name → hex. Lightness walks from `lightness[0]` to `lightness[1]`, `curve` blending an even walk toward a
 * smoothstep; chroma is `peak` scaled by the envelope `sin(πt) + lightBias·(1−t) + darkBias·t` normalized to a maximum of 1.
 */
export function lightnessRamp(p: LightnessParams): Record<string, string> {
  const n = p.steps.length;
  const at = (i: number) => (n === 1 ? 0 : i / (n - 1));
  const lightBias = p.lightBias ?? 0;
  const max = envelopeMax(lightBias, p.darkBias);

  let { hue, peak } = p;
  const anchorIndex = p.steps.findIndex((s) => p.anchor?.[s] !== undefined);
  if (anchorIndex !== -1) {
    const a = toLch(p.anchor![p.steps[anchorIndex]]);
    const e = envelope(at(anchorIndex), lightBias, p.darkBias);
    hue = a.H;
    peak = e > 1e-6 ? (a.C * max) / e : a.C;
  }

  const out: Record<string, string> = {};
  p.steps.forEach((step, i) => {
    const fixed = p.anchor?.[step];
    if (fixed !== undefined) {
      out[step] = fixed.toLowerCase();
      return;
    }
    const t = at(i);
    const L = p.lightness[0] + (p.lightness[1] - p.lightness[0]) * (t + (smoothstep(t) - t) * p.curve);
    out[step] = toHex(L, (peak * envelope(t, lightBias, p.darkBias)) / max, hue);
  });
  return out;
}

export function categoricalRamp(
  steps: readonly string[],
  gates: Partial<Constraints>,
  anchors: readonly Anchor[],
): { colors: Record<string, string>; feasible: boolean } {
  const palette = generate({ ...DEFAULT_CONSTRAINTS, ...gates, count: steps.length, anchors });
  const colors: Record<string, string> = {};
  steps.forEach((step, i) => {
    colors[step] = palette.swatches[i].hex.toLowerCase();
  });
  return { colors, feasible: palette.feasible };
}
