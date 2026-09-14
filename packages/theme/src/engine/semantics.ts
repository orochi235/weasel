import { pick, type Selection, type Varying } from '../axes';
import type { PinObject, SemanticRule } from '../definition';
import type { RawToken, TokenValue } from '../dtcg/types';
import { contrast, toLch } from './color/oklch';
import type { Issue } from './types';

const TOKEN_REF = /^\{([^}.]+)\}$/;
const HEX = /^#[0-9a-f]{6}$/i;

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

type Get = (name: string) => DerivedSemantic | undefined;
type ColorOf = (value: TokenValue | undefined) => string | undefined;

export function deriveSemantics(
  rules: Readonly<Record<string, Varying<SemanticRule>>>,
  ctx: SemanticContext,
): Map<string, DerivedSemantic> {
  const done = new Map<string, DerivedSemantic>();
  const failed = new Set<string>();
  const inProgress = new Set<string>();

  const get: Get = (name) => {
    if (done.has(name)) return done.get(name);
    if (failed.has(name) || !Object.hasOwn(rules, name)) return undefined;
    if (inProgress.has(name)) throw new Error(`Semantic cycle at "${name}" (${[...inProgress].join(' → ')})`);
    inProgress.add(name);
    const picked = pick(rules[name], ctx.sel);
    let derived: DerivedSemantic | undefined;
    if (!picked.ok) {
      ctx.issues.push({ kind: 'missing-axis-value', path: `semantics.${name}`, axis: picked.axis, value: picked.value });
    } else {
      derived = deriveOne(name, picked.value, ctx, get, color);
      const check = picked.value.check;
      if (derived && check) {
        const self = solid(ctx.pinned(name) ?? derived.token);
        for (const a of check.against) {
          const other = color(`{${a}}`);
          if (!self || !other) {
            ctx.issues.push({ kind: 'invalid', path: `semantics.${name}.check`, message: `"${a}" is not a solid color` });
            continue;
          }
          const ratio = contrast(self, other);
          if (ratio < check.contrast) ctx.issues.push({ kind: 'check-failed', token: name, against: a, min: check.contrast, ratio });
        }
      }
    }
    inProgress.delete(name);
    if (derived) done.set(name, derived);
    else failed.add(name);
    return derived;
  };

  /** A value's final solid color as hex, following references through pins; undefined for anything else. */
  const color = (value: TokenValue | undefined, depth = 0): string | undefined => {
    if (typeof value !== 'string' || depth > 32) return undefined;
    const v = value.trim();
    const m = TOKEN_REF.exec(v);
    if (!m) return HEX.test(v) ? v.toLowerCase() : undefined;
    return solid(ctx.pinned(m[1]) ?? ctx.tokens[m[1]] ?? get(m[1])?.token, depth + 1);
  };
  const solid = (t: { readonly value: TokenValue; readonly alpha?: number } | undefined, depth = 0) =>
    t && t.alpha === undefined ? color(t.value, depth) : undefined;

  for (const name of Object.keys(rules)) get(name);
  return new Map(Object.keys(rules).filter((n) => done.has(n)).map((n) => [n, done.get(n)!]));
}

function deriveOne(name: string, r: SemanticRule, ctx: SemanticContext, get: Get, color: ColorOf): DerivedSemantic | undefined {
  const description = r.description;

  if ('value' in r) {
    return { rule: 'value', token: { type: r.type ?? 'unknown', value: r.value, alpha: undefined, description } };
  }

  if ('ref' in r) {
    const type = r.type ?? ctx.tokens[r.ref]?.type ?? get(r.ref)?.token.type ?? 'unknown';
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

  const lightnessOf = (hex: string | undefined) => (hex ? toLch(hex).L : Number.NaN);
  const rampColor = (ramp: string, step: string) => color(`{${ramp}-${step}}`);

  if ('from' in r) {
    const from = get(r.from);
    if (!from?.position) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: `"${r.from}" does not end on a ramp step` });
      return undefined;
    }
    const { ramp, index } = from.position;
    const steps = ctx.ramps[ramp];
    const last = steps.length - 1;
    const darker = lightnessOf(rampColor(ramp, steps[last])) < lightnessOf(rampColor(ramp, steps[0])) ? 1 : -1;
    const sign = r.dir === 'darker' ? darker : r.dir === 'lighter' ? -darker : index <= last / 2 ? 1 : -1;
    const target = index + sign * r.offset;
    if (target < 0 || target > last) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: `offset ${r.offset} runs off ramp "${ramp}"` });
    }
    return atStep(name, ramp, Math.max(0, Math.min(last, target)), 'offset', description, ctx);
  }

  if ('contrast' in r) {
    const steps = ctx.ramps[r.ramp];
    if (!steps) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: `no ramp "${r.ramp}"` });
      return undefined;
    }
    const last = steps.length - 1;
    const colors = steps.map((s) => rampColor(r.ramp, s));
    const against = r.contrast.against.map((a) => ({ a, hex: color(`{${a}}`) }));
    if (colors.some((c) => !c) || against.some((x) => !x.hex)) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: 'contrast needs solid colors on both sides' });
      return undefined;
    }
    const meanL = against.reduce((sum, x) => sum + lightnessOf(x.hex), 0) / against.length;
    const sign = Math.abs(lightnessOf(colors[last]) - meanL) >= Math.abs(lightnessOf(colors[0]) - meanL) ? 1 : -1;
    const onRamp = r.contrast.against
      .map((a) => {
        const p = get(a)?.position;
        if (p?.ramp === r.ramp) return p.index;
        return a.startsWith(`${r.ramp}-`) ? steps.indexOf(a.slice(r.ramp.length + 1)) : -1;
      })
      .filter((i) => i >= 0);
    const start = onRamp.length === 0 ? (sign > 0 ? 0 : last) : sign > 0 ? Math.max(...onRamp) + 1 : Math.min(...onRamp) - 1;

    let best = { index: -1, worst: Number.NEGATIVE_INFINITY };
    for (let i = start; i >= 0 && i <= last; i += sign) {
      const worst = Math.min(...against.map((x) => contrast(colors[i]!, x.hex!)));
      if (worst >= r.contrast.min) return atStep(name, r.ramp, i, 'contrast', description, ctx);
      if (worst > best.worst) best = { index: i, worst };
    }
    ctx.issues.push({ kind: 'contrast-unmet', token: name, min: r.contrast.min, against: [...r.contrast.against] });
    return best.index >= 0 ? atStep(name, r.ramp, best.index, 'contrast', description, ctx) : undefined;
  }

  ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: 'unrecognized rule' });
  return undefined;
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
