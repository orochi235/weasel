import { fullSelection, isByAxis, pick, type Selection, type Varying } from '../axes';
import type { PinObject, PinValue, ThemeDefinition } from '../definition';
import type { RawToken, TokenValue } from '../dtcg/types';
import { DEFAULT_CONSTRAINTS, type Anchor, type Constraints } from './color/generate';
import { mergeChain, type Lookup } from './merge';
import { categoricalRamp, lightnessRamp } from './ramps';
import { scale } from './scales';
import { checkSemantics, deriveSemantics } from './semantics';
import { declaredSteps } from './steps';
import type { DeriveResult, Issue, Layer, Provenance } from './types';

const SEED_REF = /^\{seeds\.([\w-]+)\}$/;
const REF = /^\{([^}]+)\}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const UNTYPED = 'unknown';
/** The ramp and scale fields that take `by` and `{seeds.name}`. Descriptions are text and are never settled. */
const PARAMS = ['kind', 'steps', 'lightness', 'curve', 'hue', 'chroma', 'anchor', 'gates', 'anchors', 'base', 'step', 'ratio'];

const has = (o: object, key: string) => Object.hasOwn(o, key);

function refName(value: TokenValue): string | undefined {
  return typeof value === 'string' ? REF.exec(value.trim())?.[1] : undefined;
}

interface SettleContext {
  readonly sel: Selection;
  readonly seeds: Readonly<Record<string, number | string>>;
  /** Every seed the definition declares, whether or not it resolved at this selection. */
  readonly declaredSeeds: ReadonlySet<string>;
  readonly issues: Issue[];
}

interface Settled {
  readonly value: unknown;
  readonly ok: boolean;
}

/** `v` with every `by` picked and every `{seeds.name}` replaced, at any depth. What cannot settle is left undefined and clears `ok`. */
function settle(v: unknown, path: string, ctx: SettleContext): Settled {
  if (isByAxis(v)) {
    const picked = pick(v, ctx.sel);
    if (!picked.ok) {
      ctx.issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
      return { value: undefined, ok: false };
    }
    return settle(picked.value, path, ctx);
  }
  if (Array.isArray(v)) {
    let ok = true;
    const value = v.map((x, i) => {
      const s = settle(x, `${path}.${i}`, ctx);
      ok = s.ok && ok;
      return s.value;
    });
    return { value, ok };
  }
  if (typeof v === 'object' && v !== null) {
    let ok = true;
    const value: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const s = settle(x, `${path}.${k}`, ctx);
      ok = s.ok && ok;
      value[k] = s.value;
    }
    return { value, ok };
  }
  if (typeof v === 'string') {
    const m = SEED_REF.exec(v.trim());
    if (!m) return { value: v, ok: true };
    if (has(ctx.seeds, m[1])) return { value: ctx.seeds[m[1]], ok: true };
    // A declared seed that did not resolve already reported its missing axis value.
    if (!ctx.declaredSeeds.has(m[1])) ctx.issues.push({ kind: 'invalid', path, message: `unknown seed "${m[1]}"` });
    return { value: undefined, ok: false };
  }
  return { value: v, ok: true };
}

/** Reads a settled entry, reporting every value of the wrong shape. */
class Reader {
  ok = true;
  private readonly issues: Issue[];

  constructor(issues: Issue[]) {
    this.issues = issues;
  }

  fail(path: string, message: string): void {
    this.issues.push({ kind: 'invalid', path, message });
    this.ok = false;
  }

  num(x: unknown, path: string): number {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    this.fail(path, 'expected a number');
    return Number.NaN;
  }

  optNum(x: unknown, path: string, fallback: number): number;
  optNum(x: unknown, path: string): number | undefined;
  optNum(x: unknown, path: string, fallback?: number): number | undefined {
    return x === undefined ? fallback : this.num(x, path);
  }

  record(x: unknown, path: string): Record<string, unknown> {
    if (x === undefined) return {};
    if (typeof x === 'object' && x !== null && !Array.isArray(x)) return x as Record<string, unknown>;
    this.fail(path, 'expected an object');
    return {};
  }
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

const stepNames = (x: unknown): string[] | undefined =>
  Array.isArray(x) && x.every((s) => typeof s === 'string') ? x : undefined;

function rampColors(name: string, r: Record<string, unknown>, steps: readonly string[], ctx: SettleContext): Record<string, string> | undefined {
  const path = `ramps.${name}`;
  const read = new Reader(ctx.issues);

  if (r.kind === 'lightness') {
    const l = r.lightness;
    let lightness: [number, number] = [0, 0];
    if (Array.isArray(l) && l.length === 2) lightness = [read.num(l[0], `${path}.lightness.0`), read.num(l[1], `${path}.lightness.1`)];
    else read.fail(`${path}.lightness`, 'expected two numbers');
    const chroma = read.record(r.chroma, `${path}.chroma`);
    const peak = r.chroma === undefined ? 0 : read.num(chroma.peak, `${path}.chroma.peak`);
    const anchor: Record<string, string> = {};
    for (const [step, v] of Object.entries(read.record(r.anchor, `${path}.anchor`))) {
      if (typeof v === 'string' && HEX.test(v)) anchor[step] = v;
      else read.fail(`${path}.anchor.${step}`, 'expected a hex color');
    }
    const params = {
      steps,
      lightness,
      curve: read.optNum(r.curve, `${path}.curve`, 0),
      hue: read.optNum(r.hue, `${path}.hue`, 0),
      peak,
      lightBias: read.optNum(chroma.lightBias, `${path}.chroma.lightBias`, 0),
      darkBias: read.optNum(chroma.darkBias, `${path}.chroma.darkBias`, 0),
      anchor,
    };
    return read.ok ? lightnessRamp(params) : undefined;
  }

  if (r.kind === 'categorical') {
    const gates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(read.record(r.gates, `${path}.gates`))) {
      if (!has(DEFAULT_CONSTRAINTS, k) || k === 'count' || k === 'anchors') read.fail(`${path}.gates.${k}`, 'unknown gate');
      else if (typeof v !== typeof DEFAULT_CONSTRAINTS[k as keyof typeof DEFAULT_CONSTRAINTS]) {
        read.fail(`${path}.gates.${k}`, `expected a ${typeof DEFAULT_CONSTRAINTS[k as keyof typeof DEFAULT_CONSTRAINTS]}`);
      } else gates[k] = v;
    }
    const anchors: Anchor[] = [];
    const rawAnchors = r.anchors ?? [];
    if (!Array.isArray(rawAnchors)) read.fail(`${path}.anchors`, 'expected a list');
    else {
      rawAnchors.forEach((a, i) => {
        const at = `${path}.anchors.${i}`;
        const o = read.record(a, at);
        if (typeof o.name !== 'string') read.fail(`${at}.name`, 'expected a string');
        anchors.push({
          name: String(o.name),
          hue: read.num(o.hue, `${at}.hue`),
          lightness: read.num(o.lightness, `${at}.lightness`),
          chroma: read.optNum(o.chroma, `${at}.chroma`),
        });
      });
    }
    if (!read.ok) return undefined;
    const { colors, feasible } = categoricalRamp(steps, gates as Partial<Constraints>, anchors);
    if (!feasible) ctx.issues.push({ kind: 'infeasible-ramp', ramp: name });
    return colors;
  }

  read.fail(`${path}.kind`, 'expected "lightness" or "categorical"');
  return undefined;
}

function scaleValues(name: string, s: Record<string, unknown>, steps: readonly string[], issues: Issue[]): { values: Record<string, string>; rule: string } | undefined {
  const path = `scales.${name}`;
  const read = new Reader(issues);
  const base = read.num(s.base, `${path}.base`);
  const step = read.optNum(s.step, `${path}.step`);
  const ratio = read.optNum(s.ratio, `${path}.ratio`);
  if (!read.ok) return undefined;
  try {
    return { values: scale(steps, { base, step, ratio }), rule: step !== undefined ? 'linear' : 'geometric' };
  } catch (e) {
    issues.push({ kind: 'invalid', path, message: (e as Error).message });
    return undefined;
  }
}

/** Throws on a cycle, and on a reference to a missing name unless producing that name failed at this selection, which was reported then. */
function checkReferences(tokens: Readonly<Record<string, RawToken>>, failed: ReadonlySet<string>): void {
  const done = new Set<string>();
  for (const start of Object.keys(tokens)) {
    const trail: string[] = [];
    let name: string | undefined = start;
    while (name !== undefined && !done.has(name)) {
      if (trail.includes(name)) throw new Error(`Reference cycle at token "${name}" (${[...trail, name].join(' → ')})`);
      trail.push(name);
      const target = refName(tokens[name].value);
      if (target !== undefined && !has(tokens, target)) {
        if (!failed.has(target)) throw new Error(`Token "${name}" references "${target}", which is not defined`);
        name = undefined;
      } else {
        name = target;
      }
    }
    for (const n of trail) done.add(n);
  }
}

/**
 * Types every untyped token from what its reference chain ends on; a pin with nothing to go on takes the type of what the
 * rule under it reaches, which is also written into `generated`. Final tokens are typed before rule values are read, and
 * again whenever a rule value typed one, so no lookup sees a half-typed chain. Runs after `checkReferences`, so chains end.
 */
function inferTypes(tokens: Record<string, RawToken>, provenance: Record<string, Provenance>, failed: ReadonlySet<string>, issues: Issue[]): void {
  for (let changed = true; changed; ) {
    changed = false;
    const memo = new Map<string, string>();
    const typeOf = (start: string): string => {
      const trail: string[] = [];
      let type = UNTYPED;
      for (let name: string | undefined = start; name !== undefined && has(tokens, name); name = refName(tokens[name].value)) {
        const known = memo.get(name);
        if (known !== undefined) {
          type = known;
          break;
        }
        trail.push(name);
        if (tokens[name].type !== UNTYPED) {
          type = tokens[name].type;
          break;
        }
      }
      for (const name of trail) {
        if (type !== UNTYPED && tokens[name].type === UNTYPED) tokens[name] = { ...tokens[name], type };
        memo.set(name, type);
      }
      return type;
    };
    for (const name of Object.keys(tokens)) typeOf(name);
    for (const name of Object.keys(tokens)) {
      const p = provenance[name];
      const generated = p.generated;
      const target = generated?.type === UNTYPED ? refName(generated.value) : undefined;
      const type = target === undefined ? UNTYPED : typeOf(target);
      if (!generated || type === UNTYPED) continue;
      provenance[name] = { ...p, generated: { ...generated, type } };
      if (tokens[name].type === UNTYPED) {
        tokens[name] = { ...tokens[name], type };
        changed = true;
      }
    }
  }
  for (const [name, token] of Object.entries(tokens)) {
    // A reference is typed by what it reaches, reported there; a name whose production failed was reported then.
    if (token.type !== UNTYPED || refName(token.value) !== undefined || failed.has(name)) continue;
    issues.push({ kind: 'untyped-pin', token: name });
  }
}

const isPinObject = (v: PinValue): v is PinObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'value' in v;

const NAMED_LAYERS = ['ramps', 'scales', 'semantics', 'components', 'pins'] as const;
/** A reference reads a dot as a group, and a name reaches CSS custom properties and the generated module unescaped. */
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;
const isSafeName = (name: string) => SAFE_NAME.test(name);
const UNSAFE = (name: string) => `"${name}" cannot name a token: use letters, digits, "-" and "_"`;

function withoutUnsafeNames(def: ThemeDefinition, issues: Issue[]): ThemeDefinition {
  let out = def;
  for (const layer of NAMED_LAYERS) {
    const entries = def[layer];
    if (!entries || Object.keys(entries).every(isSafeName)) continue;
    for (const n of Object.keys(entries)) {
      if (!isSafeName(n)) issues.push({ kind: 'invalid', path: `${layer}.${n}`, message: UNSAFE(n) });
    }
    out = { ...out, [layer]: Object.fromEntries(Object.entries(entries).filter(([n]) => isSafeName(n))) };
  }
  return out;
}

/** Derive every token of `definition` for one selection. Unmet rules are reported in `issues`; cycles and dangling references throw. */
export function derive(definition: ThemeDefinition, selection: Selection = {}, lookup?: Lookup): DeriveResult {
  const issues: Issue[] = [];
  const def = withoutUnsafeNames(mergeChain(definition, lookup), issues);
  const sel = fullSelection(def.axes ?? {}, selection);
  const seeds: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(def.seeds ?? {})) {
    const picked = pick(v, sel);
    if (picked.ok) seeds[k] = picked.value;
    else issues.push({ kind: 'missing-axis-value', path: `seeds.${k}`, axis: picked.axis, value: picked.value });
  }
  const ctx: SettleContext = { sel, seeds, declaredSeeds: new Set(Object.keys(def.seeds ?? {})), issues };

  const tokens: Record<string, RawToken> = {};
  const provenance: Record<string, Provenance> = {};
  /** Names whose production was attempted and failed at this selection. */
  const failed = new Set<string>();
  const producer = new Map<string, string>();
  const put = (name: string, token: RawToken, layer: Layer, rule: string, path: string) => {
    const earlier = producer.get(name);
    if (earlier !== undefined) {
      issues.push({ kind: 'invalid', path, message: `"${name}" is already produced by ${earlier}` });
      return;
    }
    producer.set(name, path);
    tokens[name] = token;
    provenance[name] = { layer, rule, pinned: false };
  };
  /** `steps`, when they settled, are this selection's; otherwise every step the entry could declare is exempt. */
  const failEntry = (name: string, entry: unknown, steps: readonly string[] | undefined) => {
    for (const step of steps ?? declaredSteps(entry)) failed.add(`${name}-${step}`);
  };

  type SettledEntry =
    | { readonly ok: true; readonly r: Record<string, unknown>; readonly steps: string[] }
    | { readonly ok: false; readonly steps?: string[] };
  const settleEntry = (entry: unknown, path: string): SettledEntry => {
    let raw = entry;
    if (isByAxis(raw)) {
      const picked = pick(raw, sel);
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
      if (!has(raw, key)) continue;
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
    const unsafe = steps?.find((s) => !isSafeName(s));
    if (unsafe !== undefined) {
      issues.push({ kind: 'invalid', path: `${path}.steps`, message: UNSAFE(unsafe) });
      return { ok: false, steps };
    }
    return settled && steps ? { ok: true, r, steps } : { ok: false, steps };
  };
  const describe = (r: Record<string, unknown>, step: string) => {
    const d = isRecord(r.describe) ? r.describe[step] : undefined;
    return typeof d === 'string' ? d : undefined;
  };

  const rampSteps: Record<string, readonly string[]> = {};
  for (const [name, entry] of Object.entries(def.ramps ?? {})) {
    const path = `ramps.${name}`;
    const e = settleEntry(entry, path);
    if (e.steps) rampSteps[name] = e.steps;
    const colors = e.ok ? rampColors(name, e.r, e.steps, ctx) : undefined;
    if (!e.ok || !colors) {
      failEntry(name, entry, e.steps);
      continue;
    }
    for (const step of e.steps) {
      put(`${name}-${step}`, { type: 'color', value: colors[step], alpha: undefined, description: describe(e.r, step) }, 'ramps', String(e.r.kind), path);
    }
  }

  for (const [name, entry] of Object.entries(def.scales ?? {})) {
    const path = `scales.${name}`;
    const e = settleEntry(entry, path);
    const out = e.ok ? scaleValues(name, e.r, e.steps, issues) : undefined;
    if (!e.ok || !out) {
      failEntry(name, entry, e.steps);
      continue;
    }
    for (const st of e.steps) {
      put(`${name}-${st}`, { type: 'dimension', value: out.values[st], alpha: undefined, description: describe(e.r, st) }, 'scales', out.rule, path);
    }
  }

  /** `obj` with a whole-value `{seeds.name}` replaced by the seed; undefined when the seed has no value here. Reports an undeclared seed when given a path. */
  const seeded = (obj: PinObject, path?: string): PinObject | undefined => {
    const m = typeof obj.value === 'string' ? SEED_REF.exec(obj.value.trim()) : null;
    if (!m) return obj;
    if (has(seeds, m[1])) return { ...obj, value: seeds[m[1]] };
    if (path !== undefined && !ctx.declaredSeeds.has(m[1])) issues.push({ kind: 'invalid', path, message: `unknown seed "${m[1]}"` });
    return undefined;
  };
  const pinned = (name: string): PinObject | undefined => {
    const v = def.pins?.[name];
    const picked = v === undefined ? undefined : pick(v, sel);
    if (!picked?.ok) return undefined;
    return seeded(isPinObject(picked.value) ? picked.value : { value: picked.value });
  };
  const semantics = def.semantics ?? {};
  const components = def.components ?? {};
  const component = (name: string): PinObject | undefined => {
    const picked = has(components, name) ? pick(components[name], sel) : undefined;
    if (!picked?.ok) return undefined;
    return seeded(isPinObject(picked.value) ? picked.value : { value: picked.value });
  };
  const known = (name: string) =>
    has(tokens, name) || failed.has(name) || has(semantics, name) || has(components, name) || has(def.pins ?? {}, name);
  const derived = deriveSemantics(semantics, { sel, tokens, ramps: rampSteps, pinned, component, known, issues });
  for (const name of Object.keys(semantics)) {
    const d = derived.get(name);
    if (d) put(name, d.token, 'semantics', d.rule, `semantics.${name}`);
    else failed.add(name);
  }

  const toToken = (v: Varying<PinValue>, path: string, prior: RawToken | undefined): RawToken | undefined => {
    const picked = pick(v, sel);
    if (!picked.ok) {
      issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
      return undefined;
    }
    const obj = seeded(isPinObject(picked.value) ? picked.value : { value: picked.value }, path);
    if (!obj) return undefined;
    return { type: obj.type ?? prior?.type ?? UNTYPED, value: obj.value, alpha: obj.alpha, description: obj.description ?? prior?.description };
  };

  for (const [name, v] of Object.entries(components)) {
    const path = `components.${name}`;
    const token = toToken(v, path, undefined);
    if (token) put(name, token, 'components', 'value', path);
    else failed.add(name);
  }

  for (const [name, v] of Object.entries(def.pins ?? {})) {
    const prior = has(tokens, name) ? tokens[name] : undefined;
    const token = toToken(v, `pins.${name}`, prior);
    if (!token) {
      if (!prior) failed.add(name);
      continue;
    }
    tokens[name] = token;
    provenance[name] = prior
      ? { ...provenance[name], pinned: true, generated: prior }
      : { layer: 'pins', rule: 'value', pinned: false };
  }

  checkReferences(tokens, failed);
  checkSemantics(semantics, sel, tokens, known, issues);
  inferTypes(tokens, provenance, failed, issues);
  return { tokens, provenance, issues };
}
