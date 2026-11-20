import type { Guide } from './types';

/** Whether two guides are equal field by field, `span` by its ends. */
export function sameGuide(a: Guide, b: Guide): boolean {
  const keys = Object.keys(a) as (keyof Guide)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => (k === 'span'
    ? a.span?.min === b.span?.min && a.span?.max === b.span?.max && (a.span === undefined) === (b.span === undefined)
    : Object.is(a[k], b[k])));
}
