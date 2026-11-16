import { getOwn } from '@weasel-js/registry';
import { isByAxis, type ResolvedTheme } from '@weasel-js/theme';
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
  const steps = declaredSteps(entry).flatMap((step): StepView[] => {
    const token = `${name}-${step}`;
    const derived = getOwn(result.tokens, token);
    if (!derived) return [];
    const p = getOwn(result.provenance, token);
    const hex = final[`--wzl-${token}`] ?? String(derived.value);
    const generated = p?.pinned && typeof p.generated?.value === 'string' ? p.generated.value : undefined;
    return [{ step, token, hex, L: lightnessOf(hex), pinned: p?.pinned ?? false, generated }];
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

/** A lightness ramp field the editor's sliders set: one level of nesting at most, which is all a lightness ramp has. */
export type RampParam = 'curve' | 'hue' | 'lightness.0' | 'lightness.1' | 'chroma.peak' | 'chroma.lightBias' | 'chroma.darkBias';
type ParamHead = 'curve' | 'hue' | 'lightness' | 'chroma';
type ParamTail = '0' | '1' | 'peak' | 'lightBias' | 'darkBias';

const paramPath = (key: RampParam) => key.split('.') as [ParamHead, ParamTail?];

export function readParam(entry: LightnessRampDef, key: RampParam): unknown {
  const [head, tail] = paramPath(key);
  const top = (entry as unknown as Record<ParamHead, unknown>)[head];
  if (tail === undefined || isByAxis(top)) return top;
  return top && typeof top === 'object' ? (top as Partial<Record<ParamTail, unknown>>)[tail] : undefined;
}

export function writeParam(entry: LightnessRampDef, key: RampParam, value: number): LightnessRampDef {
  const [head, tail] = paramPath(key);
  const top = (entry as unknown as Record<ParamHead, unknown>)[head];
  if (isByAxis(top)) throw new Error(`${head} varies by ${top.by}; write each branch instead`);
  if (tail === undefined) return { ...entry, [head]: value };
  if (Array.isArray(top)) {
    const next = [...top];
    next[Number(tail)] = value;
    return { ...entry, [head]: next } as LightnessRampDef;
  }
  // derive requires `peak` whenever `chroma` exists, and reads an absent `chroma` as peak 0.
  const base = top === undefined && head === 'chroma' ? { peak: 0 } : (top as object | undefined);
  return { ...entry, [head]: { ...base, [tail]: value } } as LightnessRampDef;
}
