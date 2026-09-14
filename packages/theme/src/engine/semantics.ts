import { pick, type Selection, type Varying } from '../axes';
import type { PinObject, SemanticRule } from '../definition';
import type { RawToken, TokenValue } from '../dtcg/types';
import { contrast, toLch } from './color/oklch';
import type { Issue } from './types';

const TOKEN_REF = /^\{([^}.]+)\}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_DEPTH = 32;

export interface SemanticContext {
  readonly sel: Selection;
  /** Ramp and scale tokens derived so far. */
  readonly tokens: Readonly<Record<string, RawToken>>;
  /** Ramp name → its steps, in order. */
  readonly ramps: Readonly<Record<string, readonly string[]>>;
  /** The pin this token gets for the selection, if one does. Rules that measure color read final colors, not generated ones. */
  readonly pinned: (name: string) => PinObject | undefined;
  readonly issues: Issue[];
}

export interface DerivedSemantic {
  readonly token: RawToken;
  readonly rule: string;
  /** Set when the semantic ended on a ramp step. */
  readonly position?: { readonly ramp: string; readonly index: number };
}

type Position = NonNullable<DerivedSemantic['position']>;

interface Env {
  readonly get: (name: string) => DerivedSemantic | undefined;
  readonly color: (value: TokenValue | undefined) => string | undefined;
  /** The ramp step a semantic ends on once its pin applies; undefined for anything else. */
  readonly positionOf: (name: string) => Position | undefined;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

const refTarget = (value: TokenValue): string | undefined =>
  typeof value === 'string' ? TOKEN_REF.exec(value.trim())?.[1] : undefined;

export function deriveSemantics(
  rules: Readonly<Record<string, Varying<SemanticRule>>>,
  ctx: SemanticContext,
): Map<string, DerivedSemantic> {
  const done = new Map<string, DerivedSemantic>();
  const failed = new Set<string>();
  const inProgress = new Set<string>();
  const picked = new Map<string, SemanticRule>();

  const get: Env['get'] = (name) => {
    if (done.has(name)) return done.get(name);
    if (failed.has(name) || !Object.hasOwn(rules, name)) return undefined;
    if (inProgress.has(name)) throw new Error(`Semantic cycle at "${name}" (${[...inProgress].join(' → ')})`);
    inProgress.add(name);
    const p = pick(rules[name], ctx.sel);
    let derived: DerivedSemantic | undefined;
    if (!p.ok) {
      ctx.issues.push({ kind: 'missing-axis-value', path: `semantics.${name}`, axis: p.axis, value: p.value });
    } else if (!isRecord(p.value)) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: 'expected an object' });
    } else {
      picked.set(name, p.value);
      derived = deriveOne(name, p.value, ctx, env);
    }
    inProgress.delete(name);
    if (derived) done.set(name, derived);
    else failed.add(name);
    return derived;
  };

  /** A value's final solid color as hex, following references through pins; undefined for anything else. */
  const color = (value: TokenValue | undefined, depth = 0): string | undefined => {
    if (typeof value !== 'string' || depth > MAX_DEPTH) return undefined;
    const v = value.trim();
    const m = TOKEN_REF.exec(v);
    if (!m) return HEX.test(v) ? v.toLowerCase() : undefined;
    return solid(ctx.pinned(m[1]) ?? ctx.tokens[m[1]] ?? get(m[1])?.token, depth + 1);
  };
  const solid = (t: { readonly value: TokenValue; readonly alpha?: number } | undefined, depth = 0) =>
    t && t.alpha === undefined ? color(t.value, depth) : undefined;

  const rampStep = (name: string): Position | undefined => {
    if (!Object.hasOwn(ctx.tokens, name)) return undefined;
    for (const [ramp, steps] of Object.entries(ctx.ramps)) {
      const index = name.startsWith(`${ramp}-`) ? steps.indexOf(name.slice(ramp.length + 1)) : -1;
      if (index >= 0) return { ramp, index };
    }
    return undefined;
  };

  const positionOf: Env['positionOf'] = (name) => {
    if (!Object.hasOwn(rules, name)) return undefined;
    let pin = ctx.pinned(name);
    if (!pin) return get(name)?.position;
    for (let depth = 0; depth <= MAX_DEPTH; depth++) {
      const target = refTarget(pin.value);
      if (target === undefined) return undefined;
      const step = rampStep(target);
      if (step) return step;
      const next = ctx.pinned(target);
      if (!next) return Object.hasOwn(rules, target) ? get(target)?.position : undefined;
      pin = next;
    }
    return undefined;
  };

  const env: Env = { get, color, positionOf };

  for (const name of Object.keys(rules)) get(name);

  // Checks run once everything is derived, so a check is never a dependency.
  for (const name of Object.keys(rules)) {
    const check = picked.get(name)?.check;
    const self = ctx.pinned(name) ?? done.get(name)?.token;
    if (!check || !self) continue;
    const hex = solid(self);
    if (!hex) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}.check`, message: `"${name}" is not a solid color` });
      continue;
    }
    for (const a of check.against) {
      const other = color(`{${a}}`);
      if (!other) {
        ctx.issues.push({ kind: 'invalid', path: `semantics.${name}.check`, message: `"${a}" is not a solid color` });
        continue;
      }
      const ratio = contrast(hex, other);
      if (ratio < check.contrast) ctx.issues.push({ kind: 'check-failed', token: name, against: a, min: check.contrast, ratio });
    }
  }

  return new Map(Object.keys(rules).filter((n) => done.has(n)).map((n) => [n, done.get(n)!]));
}

const lightnessOf = (hex: string | undefined) => (hex ? toLch(hex).L : Number.NaN);

function deriveOne(name: string, r: SemanticRule, ctx: SemanticContext, env: Env): DerivedSemantic | undefined {
  const description = r.description;
  const invalid = (message: string) => {
    ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message });
    return undefined;
  };

  if ('value' in r) {
    return { rule: 'value', token: { type: r.type ?? 'unknown', value: r.value, alpha: undefined, description } };
  }

  if ('ref' in r) {
    const type = r.type ?? ctx.tokens[r.ref]?.type ?? env.get(r.ref)?.token.type ?? 'unknown';
    return { rule: 'ref', token: { type, value: `{${r.ref}}`, alpha: r.alpha, description } };
  }

  if ('step' in r) {
    const picked = pick(r.step, ctx.sel);
    if (!picked.ok) {
      ctx.issues.push({ kind: 'missing-axis-value', path: `semantics.${name}.step`, axis: picked.axis, value: picked.value });
      return undefined;
    }
    return atStep(name, r.ramp, (ctx.ramps[r.ramp] ?? []).indexOf(picked.value), 'step', description, ctx);
  }

  const rampColor = (ramp: string, step: string) => env.color(`{${ramp}-${step}}`);
  /** 1 when the ramp darkens toward its last step, -1 when it lightens; undefined, reported, when its ends cannot say. */
  const darkening = (ramp: string, steps: readonly string[]) => {
    const first = lightnessOf(rampColor(ramp, steps[0]));
    const last = lightnessOf(rampColor(ramp, steps[steps.length - 1]));
    if (Number.isNaN(first) || Number.isNaN(last) || first === last) return invalid(`cannot tell which end of ramp "${ramp}" is darker`);
    return last < first ? 1 : -1;
  };

  if ('from' in r) {
    const from = env.positionOf(r.from);
    if (!from) return invalid(`"${r.from}" does not end on a ramp step`);
    const { ramp, index } = from;
    const steps = ctx.ramps[ramp];
    const last = steps.length - 1;
    let sign: number;
    if (r.dir === 'darker' || r.dir === 'lighter') {
      const darker = darkening(ramp, steps);
      if (darker === undefined) return undefined;
      sign = r.dir === 'darker' ? darker : -darker;
    } else {
      sign = index <= last / 2 ? 1 : -1;
    }
    const target = index + sign * r.offset;
    if (target < 0 || target > last) invalid(`offset ${r.offset} runs off ramp "${ramp}"`);
    return atStep(name, ramp, Math.max(0, Math.min(last, target)), 'offset', description, ctx);
  }

  if ('contrast' in r) {
    const steps = ctx.ramps[r.ramp];
    if (!steps) return invalid(`no ramp "${r.ramp}"`);
    const colors = steps.map((s) => rampColor(r.ramp, s));
    const against = r.contrast.against.map((a) => env.color(`{${a}}`));
    if (colors.some((c) => !c) || against.some((hex) => !hex)) return invalid('contrast needs solid colors on both sides');
    const darker = darkening(r.ramp, steps);
    if (darker === undefined) return undefined;

    const L = colors.map(lightnessOf);
    const surfaces = against.map(lightnessOf);
    const meanL = surfaces.reduce((sum, l) => sum + l, 0) / surfaces.length;
    const last = steps.length - 1;
    const sign = Math.abs(L[last] - meanL) >= Math.abs(L[0] - meanL) ? 1 : -1;
    const order = steps.map((_, i) => (sign > 0 ? i : last - i));
    const past = (sign === darker)
      ? (l: number) => l < Math.min(...surfaces)
      : (l: number) => l > Math.max(...surfaces);
    const worst = (i: number) => Math.min(...against.map((hex) => contrast(colors[i]!, hex!)));

    const start = order.findIndex((i) => past(L[i]));
    for (const i of start < 0 ? [] : order.slice(start)) {
      if (worst(i) >= r.contrast.min) return atStep(name, r.ramp, i, 'contrast', description, ctx);
    }
    let best = { index: order[0], ratio: worst(order[0]) };
    for (const i of order) {
      const ratio = worst(i);
      if (ratio > best.ratio) best = { index: i, ratio };
    }
    ctx.issues.push({
      kind: 'contrast-unmet',
      token: name,
      min: r.contrast.min,
      against: [...r.contrast.against],
      picked: steps[best.index],
      ratio: best.ratio,
    });
    return atStep(name, r.ramp, best.index, 'contrast', description, ctx);
  }

  return invalid('unrecognized rule');
}

export function atStep(
  name: string,
  ramp: string,
  index: number,
  rule: string,
  description: string | undefined,
  ctx: SemanticContext,
): DerivedSemantic | undefined {
  const steps = ctx.ramps[ramp];
  if (!steps || index < 0 || index >= steps.length) {
    ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: `no such step on ramp "${ramp}"` });
    return undefined;
  }
  return {
    rule,
    position: { ramp, index },
    token: { type: 'color', value: `{${ramp}-${steps[index]}}`, alpha: undefined, description },
  };
}
