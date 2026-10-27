import type { FontStyle } from './fontStyle';

/** Keys already built, by style and weight, so resolving a face every frame
 *  builds no string. */
const variantKeys = new Map<FontStyle, Map<number, string>>();

/** A registered variant's key in its family's map: `<weight>|<style>`. */
export function variantKey(weight: number, style: FontStyle): string {
  let byWeight = variantKeys.get(style);
  if (byWeight === undefined) variantKeys.set(style, (byWeight = new Map()));
  let key = byWeight.get(weight);
  if (key === undefined) {
    key = `${weight}|${style}`;
    if (byWeight.size < 1024) byWeight.set(weight, key);
  }
  return key;
}
