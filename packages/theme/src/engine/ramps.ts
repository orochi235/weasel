import { DEFAULT_CONSTRAINTS, generate, type Anchor, type Constraints } from './color/generate.ts';
import { toHex, toLch } from './color/oklch.ts';

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

// Above anything sRGB holds, so the gamut clamp in toHex decides.
const MAX_CHROMA = 0.4;

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
 *
 * An anchored step emits its anchor exactly, and the anchor replaces `hue` and `peak`: its OKLCH hue becomes the hue and
 * its chroma becomes the peak, unscaled by the envelope. With several anchors, both blend linearly by step between
 * consecutive anchors, hue along the shorter arc; steps before the first anchor or after the last take that anchor's.
 */
export function lightnessRamp(p: LightnessParams): Record<string, string> {
  const n = p.steps.length;
  const at = (i: number) => (n === 1 ? 0 : i / (n - 1));
  const lightBias = p.lightBias ?? 0;
  const max = envelopeMax(lightBias, p.darkBias);

  const anchors = p.steps.flatMap((s, i) => {
    const hex = p.anchor?.[s];
    if (hex === undefined) return [];
    const { C, H } = toLch(hex);
    return [{ i, hue: H, peak: C }];
  });
  const hueAndPeak = (i: number): { hue: number; peak: number } => {
    if (anchors.length === 0) return p;
    const next = anchors.findIndex((a) => a.i >= i);
    if (next === 0) return anchors[0];
    if (next === -1) return anchors[anchors.length - 1];
    const a = anchors[next - 1];
    const b = anchors[next];
    const f = (i - a.i) / (b.i - a.i);
    const arc = ((((b.hue - a.hue) % 360) + 540) % 360) - 180;
    return { hue: (((a.hue + arc * f) % 360) + 360) % 360, peak: a.peak + (b.peak - a.peak) * f };
  };

  const out: Record<string, string> = {};
  p.steps.forEach((step, i) => {
    const fixed = p.anchor?.[step];
    if (fixed !== undefined) {
      out[step] = fixed.toLowerCase();
      return;
    }
    const t = at(i);
    const L = p.lightness[0] + (p.lightness[1] - p.lightness[0]) * (t + (smoothstep(t) - t) * p.curve);
    const { hue, peak } = hueAndPeak(i);
    out[step] = toHex(L, Math.min((peak * envelope(t, lightBias, p.darkBias)) / max, MAX_CHROMA), hue);
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
