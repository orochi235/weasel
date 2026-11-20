/** Whether a box meets a reach query's region, and the box arithmetic the tree runs on. */
import { BOX_ALL, BOX_NONE, type BoxKind, type ReachQuery, type ReachRegion } from './reachTypes';

/** Whether the box at `box[at…]` meets `region`. Closed: touching counts. */
export function regionMeets(region: ReachRegion, box: Float64Array, at: number, dim: number): boolean {
  if ('box' in region) {
    const r = region.box;
    for (let j = 0; j < dim; j++) {
      if (box[at + j]! > r[dim + j]! || box[at + dim + j]! < r[j]!) return false;
    }
    return true;
  }
  for (const { normal, offset } of region.planes) {
    let v = offset;
    for (let j = 0; j < dim; j++) v += normal[j]! * (normal[j]! >= 0 ? box[at + dim + j]! : box[at + j]!);
    if (v < 0) return false;
  }
  return true;
}

/** Whether a box of `kind` carrying `tags` meets `q`. */
export function boxMeets(kind: BoxKind, tags: number, box: Float64Array, at: number, dim: number, q: ReachQuery): boolean {
  if (kind === BOX_NONE) return false;
  let bits = tags & q.wanted;
  if (bits === 0) return false;
  if (kind === BOX_ALL) return true;
  while (bits !== 0) {
    const bit = 31 - Math.clz32(bits);
    bits &= ~(1 << bit);
    const region = q.regions[bit];
    if (region === undefined || regionMeets(region, box, at, dim)) return true;
  }
  return false;
}

/** Grow the box at `out[outAt…]`, of `kind`, by the box at `src[at…]` of `with`. Answers the kind after. */
export function unionInto(
  out: Float64Array, outAt: number, kind: BoxKind, src: Float64Array, at: number, withKind: BoxKind, dim: number,
): BoxKind {
  if (kind === BOX_ALL || withKind === BOX_NONE) return kind;
  if (withKind === BOX_ALL) return BOX_ALL;
  if (kind === BOX_NONE) {
    for (let j = 0; j < 2 * dim; j++) out[outAt + j] = src[at + j]!;
    return withKind;
  }
  for (let j = 0; j < dim; j++) {
    if (src[at + j]! < out[outAt + j]!) out[outAt + j] = src[at + j]!;
    if (src[at + dim + j]! > out[outAt + dim + j]!) out[outAt + dim + j] = src[at + dim + j]!;
  }
  return kind;
}

/** Whether two boxes of the tree's layout hold the same numbers. */
export function sameBox(a: Float64Array, at: number, b: Float64Array, bt: number, dim: number): boolean {
  for (let j = 0; j < 2 * dim; j++) if (a[at + j] !== b[bt + j]) return false;
  return true;
}
