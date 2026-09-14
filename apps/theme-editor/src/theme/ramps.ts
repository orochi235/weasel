import type { ResolvedTheme } from '@weasel-js/theme';
import { declaredSteps, toLch, type DeriveResult, type LightnessRampDef, type RampDef } from '@weasel-js/theme/engine';

export interface StepView {
  readonly step: string;
  readonly token: string;
  /** The final color, pins applied. */
  readonly hex: string;
  readonly L: number;
  readonly pinned: boolean;
  /** What the generator made, when a pin replaced it. */
  readonly generated: string | undefined;
}

export interface RampView {
  readonly name: string;
  readonly kind: RampDef['kind'];
  readonly steps: readonly StepView[];
  /** |ΔL| between neighbors, one fewer than the steps. */
  readonly dL: readonly number[];
  readonly generatedDL: readonly number[];
  /** Largest step in L over the smallest; null under two measurable steps. */
  readonly spread: number | null;
  readonly generatedSpread: number | null;
  readonly anyPinned: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;
const lightnessOf = (hex: string) => (HEX.test(hex) ? toLch(hex).L : Number.NaN);
const deltas = (Ls: readonly number[]) => Ls.slice(1).map((L, i) => Math.abs(L - Ls[i]));

function spreadOf(ds: readonly number[]): number | null {
  const usable = ds.filter((d) => Number.isFinite(d) && d > 0);
  return usable.length < 2 ? null : Math.max(...usable) / Math.min(...usable);
}

export function rampView(name: string, entry: RampDef, result: DeriveResult, resolved: ResolvedTheme): RampView {
  const final = resolved as Readonly<Record<string, string>>;
  const steps = declaredSteps(entry)
    .filter((step) => Object.hasOwn(result.tokens, `${name}-${step}`))
    .map((step): StepView => {
      const token = `${name}-${step}`;
      const p = result.provenance[token];
      const hex = final[`--wzl-${token}`] ?? String(result.tokens[token].value);
      const generated = p?.pinned && typeof p.generated?.value === 'string' ? p.generated.value : undefined;
      return { step, token, hex, L: lightnessOf(hex), pinned: p?.pinned ?? false, generated };
    });
  const dL = deltas(steps.map((s) => s.L));
  const generatedDL = deltas(steps.map((s) => lightnessOf(s.generated ?? s.hex)));
  return {
    name,
    kind: entry.kind,
    steps,
    dL,
    generatedDL,
    spread: spreadOf(dL),
    generatedSpread: spreadOf(generatedDL),
    anyPinned: steps.some((s) => s.pinned),
  };
}

/** `curve`, `lightness.0`, `chroma.peak`: one level of nesting, which is all a lightness ramp has. */
export function readParam(entry: LightnessRampDef, key: string): unknown {
  const [head, tail] = key.split('.');
  const top = (entry as unknown as Record<string, unknown>)[head];
  if (tail === undefined) return top;
  return top && typeof top === 'object' ? (top as Record<string, unknown>)[tail] : undefined;
}

export function writeParam(entry: LightnessRampDef, key: string, value: number): LightnessRampDef {
  const [head, tail] = key.split('.');
  if (tail === undefined) return { ...entry, [head]: value };
  const top = (entry as unknown as Record<string, unknown>)[head];
  if (Array.isArray(top)) {
    const next = [...top];
    next[Number(tail)] = value;
    return { ...entry, [head]: next } as LightnessRampDef;
  }
  // derive requires `peak` whenever `chroma` exists, and reads an absent `chroma` as peak 0.
  const base = top === undefined && head === 'chroma' ? { peak: 0 } : (top as object | undefined);
  return { ...entry, [head]: { ...base, [tail]: value } } as LightnessRampDef;
}
