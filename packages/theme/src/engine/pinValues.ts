import { hasOwnKey, isPlainObject } from '@weasel-js/registry';
import { pick, type Varying } from '../axes.ts';
import type { PinObject, PinValue } from '../definition.ts';
import type { RawToken } from '../dtcg/types.ts';
import type { SettleContext } from './entries.ts';
import { UNTYPED } from './references.ts';

const SEED_REF = /^\{seeds\.([\w-]+)\}$/;

const isPinObject = (v: PinValue): v is PinObject =>
  isPlainObject(v) && 'value' in v;

/** `obj` with a whole-value `{seeds.name}` replaced by the seed; undefined when the seed has no value here. Reports an undeclared seed when given a path. */
function seeded(obj: PinObject, ctx: SettleContext, path?: string): PinObject | undefined {
  const m = typeof obj.value === 'string' ? SEED_REF.exec(obj.value.trim()) : null;
  if (!m) return obj;
  if (hasOwnKey(ctx.seeds, m[1])) return { ...obj, value: ctx.seeds[m[1]] };
  if (path !== undefined && !ctx.declaredSeeds.has(m[1])) ctx.issues.push({ kind: 'invalid', path, message: `unknown seed "${m[1]}"` });
  return undefined;
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
  return { type: obj.type ?? prior?.type ?? UNTYPED, value: obj.value, alpha: obj.alpha, description: obj.description ?? prior?.description, scope: obj.scope };
}
