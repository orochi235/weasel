import { hasOwnKey, isPlainObject } from '@weasel-js/registry';
import { pick, type Varying } from '../axes.ts';
import type { PinObject, PinValue } from '../definition.ts';
import type { RawToken } from '../dtcg/types.ts';
import type { SettleContext } from './entries.ts';
import { UNTYPED } from './references.ts';
import { pinProblem } from './ruleShape.ts';

const SEED_REF = /^\{seeds\.([\w-]+)\}$/;

const isPinObject = (v: PinValue): v is PinObject =>
  isPlainObject(v) && 'value' in v;

const seedName = (x: unknown) => (typeof x === 'string' ? SEED_REF.exec(x.trim())?.[1] : undefined);

/** `obj` with a `{seeds.name}` value, or list item, replaced by the seed; undefined when a seed has no value here. Reports an undeclared seed when given a path. */
function seeded(obj: PinObject, ctx: SettleContext, path?: string): PinObject | undefined {
  let ok = true;
  const resolve = (x: unknown, at?: string): unknown => {
    const name = seedName(x);
    if (name === undefined) return x;
    if (hasOwnKey(ctx.seeds, name)) return ctx.seeds[name];
    if (at !== undefined && !ctx.declaredSeeds.has(name)) ctx.issues.push({ kind: 'invalid', path: at, message: `unknown seed "${name}"` });
    ok = false;
    return undefined;
  };
  const value = Array.isArray(obj.value)
    ? obj.value.map((x, i) => resolve(x, path === undefined ? undefined : `${path}.${i}`))
    : resolve(obj.value, path);
  if (!ok) return undefined;
  return value === obj.value ? obj : { ...obj, value: value as PinObject['value'] };
}

/** A pin or component value at this selection, seeds resolved, reporting nothing; undefined when it has none here. */
export function pinAt(v: Varying<PinValue>, ctx: SettleContext): PinObject | undefined {
  const picked = pick(v, ctx.sel);
  if (!picked.ok) return undefined;
  return seeded(isPinObject(picked.value) ? picked.value : { value: picked.value }, ctx);
}

/** A pin or component value as a token at this selection, over what a rule produced (`prior`); reports why it has none. */
export function pinToken(v: Varying<PinValue>, path: string, prior: RawToken | undefined, ctx: SettleContext): RawToken | undefined {
  const picked = pick(v, ctx.sel);
  if (!picked.ok) {
    ctx.issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
    return undefined;
  }
  const obj = seeded(isPinObject(picked.value) ? picked.value : { value: picked.value }, ctx, path);
  if (!obj) return undefined;
  const problem = pinProblem(obj as unknown as Record<string, unknown>);
  if (problem) {
    ctx.issues.push({ kind: 'invalid', path, message: problem });
    return undefined;
  }
  return { type: obj.type ?? prior?.type ?? UNTYPED, value: obj.value, alpha: obj.alpha, description: obj.description ?? prior?.description, scope: obj.scope };
}
