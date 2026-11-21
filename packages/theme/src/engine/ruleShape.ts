import { isPlainObject, isFiniteNumber } from '@weasel-js/registry';
import { isByAxis } from '../axes.ts';
import { isAlpha } from '../dtcg/types.ts';

const DIRS = ['lighter', 'darker', 'away'];

const isString = (x: unknown): x is string => typeof x === 'string';
const isNames = (x: unknown): x is string[] => Array.isArray(x) && x.every(isString);
const isTokenValue = (x: unknown) => isString(x) || isFiniteNumber(x) || (Array.isArray(x) && x.every((v) => isString(v) || isFiniteNumber(v)));

/** Whether every leaf of a possibly `by`-varying value passes `ok`. */
function everyLeaf(v: unknown, ok: (leaf: unknown) => boolean): boolean {
  return isByAxis(v) ? Object.entries(v).every(([k, x]) => k === 'by' || everyLeaf(x, ok)) : ok(v);
}

/** Why `check` cannot be read, or undefined when it is absent or well formed. */
export function checkProblem(check: unknown): string | undefined {
  if (check === undefined) return undefined;
  if (!isPlainObject(check) || !isFiniteNumber(check.contrast) || !isNames(check.against)) return 'check needs a number contrast and a list of names against';
  return undefined;
}

const isAlpha = (x: unknown) => isFiniteNumber(x) && x >= 0 && x <= 1;

/** Why a pin or component value (already picked for a selection, seeds resolved) cannot be read, or undefined when its fields have the types they need. */
export function pinProblem(p: Readonly<Record<string, unknown>>): string | undefined {
  if (!isTokenValue(p.value)) return 'value must be a string, a number, or a list of those';
  if (p.type !== undefined && !isString(p.type)) return 'type must be a string';
  if (p.description !== undefined && !isString(p.description)) return 'description must be a string';
  if (p.alpha !== undefined && !isAlpha(p.alpha)) return 'alpha must be a number from 0 to 1';
  if (p.scope !== undefined && !isNames(p.scope)) return 'scope must be a list of axis names';
  return undefined;
}

/** Why a semantic rule (already picked for a selection) cannot be read, or undefined when its fields have the types its kind needs. */
export function ruleProblem(r: Readonly<Record<string, unknown>>): string | undefined {
  if (r.type !== undefined && !isString(r.type)) return 'type must be a string';
  if (r.description !== undefined && !isString(r.description)) return 'description must be a string';
  const check = checkProblem(r.check);
  if (check) return check;
  if ('value' in r) return isTokenValue(r.value) ? undefined : 'value must be a string, a number, or a list of those';
  if ('ref' in r) {
    if (!isString(r.ref)) return 'ref must name a token';
    return r.alpha === undefined || isAlpha(r.alpha) ? undefined : 'alpha must be a number from 0 to 1';
  }
  if ('step' in r) return isString(r.ramp) && everyLeaf(r.step, isString) ? undefined : 'a step rule needs a ramp name and a step name';
  if ('from' in r) {
    if (!isString(r.from) || !Number.isInteger(r.offset) || !DIRS.includes(r.dir as string)) return `an offset rule needs a name from, a whole-number offset, and a dir of ${DIRS.join(', ')}`;
    return undefined;
  }
  if ('contrast' in r) {
    const c = r.contrast;
    if (!isString(r.ramp) || !isPlainObject(c) || !isFiniteNumber(c.min) || !isNames(c.against)) return 'a contrast rule needs a ramp name, a number min, and a list of names against';
    return undefined;
  }
  return 'unrecognized rule';
}
