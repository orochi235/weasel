import type { FontStyle } from './fontStyle';
import type { FontEntry, ResolveResult } from './registerFont';

/** A resolution landing on a baked atlas face. */
export function atlasResult(
  entry: FontEntry, family: string, weight: number, style: FontStyle, bold: boolean, italic: boolean,
): ResolveResult {
  return { entry, resolved: { family, weight, style }, synthetic: { bold, italic }, source: 'atlas' };
}

const exactResults = new WeakMap<FontEntry, Readonly<ResolveResult>>();

/** The exact match on `entry`, one frozen object per face for as long as the
 *  face stays registered. */
export function sharedExactResult(
  entry: FontEntry, family: string, weight: number, style: FontStyle,
): Readonly<ResolveResult> {
  const hit = exactResults.get(entry);
  if (hit !== undefined && hit.resolved.family === family && hit.resolved.weight === weight
    && hit.resolved.style === style) return hit;
  const r = atlasResult(entry, family, weight, style, false, false);
  Object.freeze(r.resolved);
  Object.freeze(r.synthetic);
  exactResults.set(entry, Object.freeze(r));
  return r;
}
