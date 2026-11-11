import { isPlainObject } from '@weasel-js/registry';
import { isByAxis } from '../axes.ts';

const DIRS = ['lighter', 'darker', 'away'];

const isString = (x: unknown): x is string => typeof x === 'string';
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isNames = (x: unknown): x is string[] => Array.isArray(x) && x.every(isString);
const isTokenValue = (x: unknown) => isString(x) || isNumber(x) || (Array.isArray(x) && x.every((v) => isString(v) || isNumber(v)));

/** Whether every leaf of a possibly `by`-varying value passes `ok`. */
function everyLeaf(v: unknown, ok: (leaf: unknown) => boolean): boolean {
  return isByAxis(v) ? Object.entries(v).every(([k, x]) => k === 'by' || everyLeaf(x, ok)) : ok(v);
}

/** Why `check` cannot be read, or undefined when it is absent or well formed. */
export function checkProblem(check: unknown): string | undefined {
  if (check === undefined) return undefined;
  if (!isPlainObject(check) || !isNumber(check.contrast) || !isNames(check.against)) return 'check needs a number contrast and a list of names against';
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
    return r.alpha === undefined || isNumber(r.alpha) ? undefined : 'alpha must be a number';
  }
  if ('step' in r) return isString(r.ramp) && everyLeaf(r.step, isString) ? undefined : 'a step rule needs a ramp name and a step name';
  if ('from' in r) {
    if (!isString(r.from) || !isNumber(r.offset) || !DIRS.includes(r.dir as string)) return `an offset rule needs a name from, a number offset, and a dir of ${DIRS.join(', ')}`;
    return undefined;
  }
  if ('contrast' in r) {
    const c = r.contrast;
    if (!isString(r.ramp) || !isPlainObject(c) || !isNumber(c.min) || !isNames(c.against)) return 'a contrast rule needs a ramp name, a number min, and a list of names against';
    return undefined;
  }
  return 'unrecognized rule';
}
