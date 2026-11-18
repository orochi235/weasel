import { getOwn, hasOwnKey, setOwn } from '@weasel-js/registry';
import { fullAxisChoice, isByAxis, pick, type AxisChoice, type Varying } from '../axes.ts';
import type { PinValue, ThemeDefinition } from '../definition.ts';
import { isSafeTokenName, unsafeTokenName } from '../dtcg/types.ts';
import { axisIssues } from './axisIssues.ts';
import { isRecord, rampColors, scaleValues, settle, stepNames, type SettleContext } from './entries.ts';
import { mergeChain, type Lookup } from './merge.ts';
import { pinAt, pinToken } from './pinValues.ts';
import { checkReferences, inferTypes } from './references.ts';
import { withoutUnsafeNames } from './safeNames.ts';
import { checkSemantics, deriveSemantics } from './semantics.ts';
import { createTokenSink, type TokenSink } from './tokenSink.ts';
import type { DeriveResult, Issue } from './types.ts';

/** The ramp and scale fields that take `by` and `{seeds.name}`. Descriptions are text and are never settled. */
const PARAMS = ['kind', 'steps', 'lightness', 'curve', 'hue', 'chroma', 'anchor', 'gates', 'anchors', 'base', 'step', 'ratio', 'factors'] as const;

type SettledEntry =
  | { readonly ok: true; readonly r: Record<string, unknown>; readonly steps: string[] }
  | { readonly ok: false; readonly steps?: string[] };

/** A ramp or scale entry at this selection, every parameter settled and its step names checked. */
function settleEntry(entry: unknown, path: string, ctx: SettleContext): SettledEntry {
  const { issues } = ctx;
  let raw = entry;
  if (isByAxis(raw)) {
    const picked = pick(raw, ctx.sel);
    if (!picked.ok) {
      issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
      return { ok: false };
    }
    raw = picked.value;
  }
  if (!isRecord(raw)) {
    issues.push({ kind: 'invalid', path, message: 'expected an object' });
    return { ok: false };
  }
  const r: Record<string, unknown> = { ...raw };
  let settled = true;
  for (const key of PARAMS) {
    if (!hasOwnKey(raw, key)) continue;
    const s = settle(raw[key], `${path}.${key}`, ctx);
    r[key] = s.value;
    settled = s.ok && settled;
  }
  const steps = stepNames(r.steps);
  if (!steps && settled) issues.push({ kind: 'invalid', path: `${path}.steps`, message: 'expected a list of step names' });
  if (steps?.includes('by')) {
    issues.push({ kind: 'invalid', path: `${path}.steps`, message: '"by" is reserved and cannot name a step' });
    return { ok: false, steps };
  }
  const unsafe = steps?.find((s) => !isSafeTokenName(s));
  if (unsafe !== undefined) {
    issues.push({ kind: 'invalid', path: `${path}.steps`, message: unsafeTokenName(unsafe) });
    return { ok: false, steps };
  }
  return settled && steps ? { ok: true, r, steps } : { ok: false, steps };
}

function describe(r: Record<string, unknown>, step: string): string | undefined {
  const d = isRecord(r.describe) ? getOwn(r.describe, step) : undefined;
  return typeof d === 'string' ? d : undefined;
}

/** The definition's seeds at this selection; a seed with no value here is reported and left out. */
function seedsAt(seedDefs: ThemeDefinition['seeds'], sel: AxisChoice, issues: Issue[]): Record<string, number | string> {
  const seeds: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(seedDefs ?? {})) {
    const picked = pick(v, sel);
    if (picked.ok) setOwn(seeds, k, picked.value);
    else issues.push({ kind: 'missing-axis-value', path: `seeds.${k}`, axis: picked.axis, value: picked.value });
  }
  return seeds;
}

/** Put every ramp's colors; returns each ramp's step names, where they settled. */
function putRamps(ramps: ThemeDefinition['ramps'], ctx: SettleContext, sink: TokenSink): Record<string, readonly string[]> {
  const rampSteps: Record<string, readonly string[]> = {};
  for (const [name, entry] of Object.entries(ramps ?? {})) {
    const path = `ramps.${name}`;
    const e = settleEntry(entry, path, ctx);
    if (e.steps) setOwn(rampSteps, name, e.steps);
    const colors = e.ok ? rampColors(name, e.r, e.steps, ctx) : undefined;
    if (!e.ok || !colors) {
      sink.failEntry(name, entry, e.steps);
      continue;
    }
    for (const step of e.steps) {
      sink.put(`${name}-${step}`, { type: 'color', value: getOwn(colors, step)!, alpha: undefined, description: describe(e.r, step) }, 'ramps', String(e.r.kind), path);
    }
  }
  return rampSteps;
}

function putScales(scales: ThemeDefinition['scales'], ctx: SettleContext, sink: TokenSink): void {
  for (const [name, entry] of Object.entries(scales ?? {})) {
    const path = `scales.${name}`;
    const e = settleEntry(entry, path, ctx);
    const out = e.ok ? scaleValues(name, e.r, e.steps, ctx.issues) : undefined;
    if (!e.ok || !out) {
      sink.failEntry(name, entry, e.steps);
      continue;
    }
    for (const st of e.steps) {
      sink.put(`${name}-${st}`, { type: 'dimension', value: getOwn(out.values, st)!, alpha: undefined, description: describe(e.r, st) }, 'scales', out.rule, path);
    }
  }
}

/** Write each pin over what the rules produced, keeping the rule's token as `generated`. */
function applyPins(pins: Readonly<Record<string, Varying<PinValue>>>, ctx: SettleContext, sink: TokenSink): void {
  const { tokens, provenance } = sink;
  for (const [name, v] of Object.entries(pins)) {
    const prior = hasOwnKey(tokens, name) ? tokens[name] : undefined;
    // A by-axis pin that leaves this selection out overrides nothing here.
    if (prior && !pick(v, ctx.sel).ok) continue;
    const token = pinToken(v, `pins.${name}`, prior, ctx);
    if (!token) {
      if (!prior) sink.failed.add(name);
      continue;
    }
    setOwn(tokens, name, token);
    setOwn(provenance, name, prior
      ? { ...getOwn(provenance, name)!, pinned: true, generated: prior }
      : { layer: 'pins', rule: 'value', pinned: false });
  }
}

/** Derive every token of `definition` for one selection. Unmet rules are reported in `issues`; cycles and dangling references throw. */
export function derive(definition: ThemeDefinition, selection: AxisChoice = {}, lookup?: Lookup): DeriveResult {
  const issues: Issue[] = [];
  const def = withoutUnsafeNames(mergeChain(definition, lookup), issues);
  issues.push(...axisIssues(def.axes ?? {}));
  const sel = fullAxisChoice(def.axes ?? {}, selection);
  const seeds = seedsAt(def.seeds, sel, issues);
  const ctx: SettleContext = { sel, seeds, declaredSeeds: new Set(Object.keys(def.seeds ?? {})), issues };
  const sink = createTokenSink(issues);
  const { tokens, failed } = sink;

  const rampSteps = putRamps(def.ramps, ctx, sink);
  putScales(def.scales, ctx, sink);

  const pins = def.pins ?? {};
  const semantics = def.semantics ?? {};
  const components = def.components ?? {};
  const pinned = (name: string) => (def.pins && hasOwnKey(def.pins, name) ? pinAt(def.pins[name], ctx) : undefined);
  const component = (name: string) => (hasOwnKey(components, name) ? pinAt(components[name], ctx) : undefined);
  const known = (name: string) =>
    hasOwnKey(tokens, name) || failed.has(name) || hasOwnKey(semantics, name) || hasOwnKey(components, name) || hasOwnKey(pins, name);
  const derived = deriveSemantics(semantics, { sel, tokens, ramps: rampSteps, pinned, component, known, issues });
  for (const name of Object.keys(semantics)) {
    const d = derived.get(name);
    if (d) sink.put(name, d.token, 'semantics', d.rule, `semantics.${name}`);
    else failed.add(name);
  }

  for (const [name, v] of Object.entries(components)) {
    const path = `components.${name}`;
    const token = pinToken(v, path, undefined, ctx);
    if (token) sink.put(name, token, 'components', 'value', path);
    else failed.add(name);
  }

  applyPins(pins, ctx, sink);

  checkReferences(tokens, failed);
  checkSemantics(semantics, sel, tokens, known, issues);
  inferTypes(tokens, sink.provenance, failed, issues);
  return { tokens, provenance: sink.provenance, issues };
}
