import { fullSelection, pick, type Selection, type Varying } from '../axes';
import type { PinObject, PinValue, RampDef, ThemeDefinition } from '../definition';
import { resolveTokens } from '../dtcg/resolve';
import type { RawToken, TokenValue } from '../dtcg/types';
import { mergeChain, type Lookup } from './merge';
import { categoricalRamp, lightnessRamp } from './ramps';
import { scale } from './scales';
import { deriveSemantics } from './semantics';
import type { DeriveResult, Issue, Layer, Provenance } from './types';

const SEED_REF = /^\{seeds\.([\w-]+)\}$/;
const TOKEN_REF = /^\{([^}.]+)\}$/;

interface ParamContext {
  readonly sel: Selection;
  readonly seeds: Readonly<Record<string, number | string>>;
  readonly issues: Issue[];
}

function param(v: Varying<number | string>, path: string, ctx: ParamContext): number | string | undefined {
  const picked = pick(v, ctx.sel);
  if (!picked.ok) {
    ctx.issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
    return undefined;
  }
  const raw = picked.value;
  const m = typeof raw === 'string' ? SEED_REF.exec(raw.trim()) : null;
  if (!m) return raw;
  if (!(m[1] in ctx.seeds)) {
    ctx.issues.push({ kind: 'invalid', path, message: `unknown seed "${m[1]}"` });
    return undefined;
  }
  return ctx.seeds[m[1]];
}

function num(v: Varying<number | string> | undefined, path: string, ctx: ParamContext): number | undefined {
  if (v === undefined) return undefined;
  const x = param(v, path, ctx);
  if (x === undefined || typeof x === 'number') return x;
  ctx.issues.push({ kind: 'invalid', path, message: 'expected a number' });
  return undefined;
}

function rampColors(name: string, ramp: RampDef, ctx: ParamContext): Record<string, string> | undefined {
  const path = `ramps.${name}`;
  if (ramp.kind === 'lightness') {
    const l0 = num(ramp.lightness[0], `${path}.lightness`, ctx);
    const l1 = num(ramp.lightness[1], `${path}.lightness`, ctx);
    if (l0 === undefined || l1 === undefined) return undefined;
    const anchor: Record<string, string> = {};
    for (const [step, v] of Object.entries(ramp.anchor ?? {})) {
      const x = param(v, `${path}.anchor.${step}`, ctx);
      if (typeof x === 'string') anchor[step] = x;
    }
    return lightnessRamp({
      steps: ramp.steps,
      lightness: [l0, l1],
      curve: num(ramp.curve, `${path}.curve`, ctx) ?? 0,
      hue: num(ramp.hue, `${path}.hue`, ctx) ?? 0,
      peak: num(ramp.chroma?.peak, `${path}.chroma.peak`, ctx) ?? 0,
      darkBias: num(ramp.chroma?.darkBias, `${path}.chroma.darkBias`, ctx) ?? 0,
      anchor,
    });
  }
  const gates: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(ramp.gates ?? {})) {
    const x = param(v, `${path}.gates.${k}`, ctx);
    if (x !== undefined) gates[k] = x;
  }
  const { colors, feasible } = categoricalRamp(ramp.steps, gates, ramp.anchors ?? []);
  if (!feasible) ctx.issues.push({ kind: 'infeasible-ramp', ramp: name });
  return colors;
}

const isPinObject = (v: PinValue): v is PinObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'value' in v;

/** Derive every token of `definition` for one selection. Unmet rules are reported in `issues`; cycles and dangling references throw. */
export function derive(definition: ThemeDefinition, selection: Selection = {}, lookup?: Lookup): DeriveResult {
  const def = mergeChain(definition, lookup);
  const sel = fullSelection(def.axes ?? {}, selection);
  const issues: Issue[] = [];
  const seeds: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(def.seeds ?? {})) {
    const picked = pick(v, sel);
    if (picked.ok) seeds[k] = picked.value;
    else issues.push({ kind: 'missing-axis-value', path: `seeds.${k}`, axis: picked.axis, value: picked.value });
  }
  const ctx: ParamContext = { sel, seeds, issues };

  const tokens: Record<string, RawToken> = {};
  const provenance: Record<string, Provenance> = {};
  const put = (name: string, token: RawToken, layer: Layer, rule: string) => {
    tokens[name] = token;
    provenance[name] = { layer, rule, pinned: false };
  };

  const rampSteps: Record<string, readonly string[]> = {};
  for (const [name, ramp] of Object.entries(def.ramps ?? {})) {
    rampSteps[name] = ramp.steps;
    const colors = rampColors(name, ramp, ctx);
    if (!colors) continue;
    for (const step of ramp.steps) {
      put(`${name}-${step}`, { type: 'color', value: colors[step], alpha: undefined, description: ramp.describe?.[step] }, 'ramps', ramp.kind);
    }
  }

  for (const [name, s] of Object.entries(def.scales ?? {})) {
    const base = num(s.base, `scales.${name}.base`, ctx);
    const step = num(s.step, `scales.${name}.step`, ctx);
    const ratio = num(s.ratio, `scales.${name}.ratio`, ctx);
    if (base === undefined) continue;
    try {
      const values = scale(s.steps, { base, step, ratio });
      for (const st of s.steps) {
        put(`${name}-${st}`, { type: 'dimension', value: values[st], alpha: undefined, description: s.describe?.[st] }, 'scales', step !== undefined ? 'linear' : 'geometric');
      }
    } catch (e) {
      issues.push({ kind: 'invalid', path: `scales.${name}`, message: (e as Error).message });
    }
  }

  const pinned = (name: string): TokenValue | undefined => {
    const v = def.pins?.[name];
    const picked = v === undefined ? undefined : pick(v, sel);
    if (!picked?.ok) return undefined;
    return isPinObject(picked.value) ? picked.value.value : picked.value;
  };
  for (const [name, d] of deriveSemantics(def.semantics ?? {}, { sel, tokens, ramps: rampSteps, pinned, issues })) {
    put(name, d.token, 'semantics', d.rule);
  }

  const refType = (value: TokenValue): string | undefined => {
    const m = typeof value === 'string' ? TOKEN_REF.exec(value.trim()) : null;
    return m ? tokens[m[1]]?.type : undefined;
  };
  const toToken = (name: string, v: Varying<PinValue>, path: string, prior: RawToken | undefined): RawToken | undefined => {
    const picked = pick(v, sel);
    if (!picked.ok) {
      issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
      return undefined;
    }
    const obj: PinObject = isPinObject(picked.value) ? picked.value : { value: picked.value };
    const type = obj.type ?? prior?.type ?? refType(obj.value);
    if (type === undefined) issues.push({ kind: 'untyped-pin', token: name });
    return { type: type ?? 'unknown', value: obj.value, alpha: obj.alpha, description: obj.description ?? prior?.description };
  };

  for (const [name, v] of Object.entries(def.components ?? {})) {
    const token = toToken(name, v, `components.${name}`, undefined);
    if (token) put(name, token, 'components', 'value');
  }

  for (const [name, v] of Object.entries(def.pins ?? {})) {
    const prior = tokens[name];
    const token = toToken(name, v, `pins.${name}`, prior);
    if (!token) continue;
    tokens[name] = token;
    provenance[name] = prior
      ? { ...provenance[name], pinned: true, generated: prior }
      : { layer: 'pins', rule: 'value', pinned: false };
  }

  resolveTokens(tokens);
  return { tokens, provenance, issues };
}
