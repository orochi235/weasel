import { pick, type Selection, type Varying } from '../axes';
import type { SemanticRule } from '../definition';
import type { RawToken, TokenValue } from '../dtcg/types';
import type { Issue } from './types';

export interface SemanticContext {
  readonly sel: Selection;
  /** Ramp and scale tokens derived so far. */
  readonly tokens: Readonly<Record<string, RawToken>>;
  /** Ramp name → its steps, in order. */
  readonly ramps: Readonly<Record<string, readonly string[]>>;
  /** The value a pin will give this token for the selection, if one does. Rules that measure color read final colors, not generated ones. */
  readonly pinned: (name: string) => TokenValue | undefined;
  readonly issues: Issue[];
}

export interface DerivedSemantic {
  readonly token: RawToken;
  readonly rule: string;
  /** Set when the semantic ended on a ramp step. */
  readonly position?: { readonly ramp: string; readonly index: number };
}

type Get = (name: string) => DerivedSemantic | undefined;

export function deriveSemantics(
  rules: Readonly<Record<string, Varying<SemanticRule>>>,
  ctx: SemanticContext,
): Map<string, DerivedSemantic> {
  const done = new Map<string, DerivedSemantic>();
  const inProgress = new Set<string>();

  const get: Get = (name) => {
    if (done.has(name)) return done.get(name);
    if (!(name in rules)) return undefined;
    if (inProgress.has(name)) throw new Error(`Semantic cycle at "${name}" (${[...inProgress].join(' → ')})`);
    inProgress.add(name);
    const picked = pick(rules[name], ctx.sel);
    let derived: DerivedSemantic | undefined;
    if (!picked.ok) {
      ctx.issues.push({ kind: 'missing-axis-value', path: `semantics.${name}`, axis: picked.axis, value: picked.value });
    } else {
      derived = deriveOne(name, picked.value, ctx, get);
    }
    inProgress.delete(name);
    if (derived) done.set(name, derived);
    return derived;
  };

  for (const name of Object.keys(rules)) get(name);
  return new Map(Object.keys(rules).filter((n) => done.has(n)).map((n) => [n, done.get(n)!]));
}

function deriveOne(name: string, r: SemanticRule, ctx: SemanticContext, get: Get): DerivedSemantic | undefined {
  const description = r.description;

  if ('value' in r) {
    if (r.type === undefined) ctx.issues.push({ kind: 'untyped-pin', token: name });
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

  ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: 'rule kind not supported yet' });
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
