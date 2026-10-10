import type { PrefBase, PrefObject } from './schema';

/**
 * A leaf whose value is one of several object shapes, told apart by the
 * string its `tag` field holds: `{ type: 'linear', angle: 90 }` or
 * `{ type: 'radial', radius: 1 }` under `tag: 'type'`.
 *
 * Each variant is an `object` leaf keyed by its tag value. Its `children`
 * are the fields beside the tag, its `name` is what a person chooses, and
 * its `default` (without the tag) is what the value becomes when they choose
 * it. A stored value whose tag names no variant reads as the leaf's default.
 */
export interface PrefUnion extends PrefBase<'union', unknown> {
  tag: string;
  variants: Record<string, PrefObject>;
}

/** The variant `value` is, or `undefined` when its tag names none. */
export function prefVariantOf(leaf: PrefUnion, value: unknown): [key: string, variant: PrefObject] | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const key = (value as Record<string, unknown>)[leaf.tag];
  if (typeof key !== 'string' || !Object.hasOwn(leaf.variants, key)) return undefined;
  return [key, leaf.variants[key]!];
}

/** The value a union takes on switching to the variant at `key`: that variant's default, tagged. */
export function prefVariantDefault(leaf: PrefUnion, key: string): Record<string, unknown> {
  const held = leaf.variants[key]?.default;
  const fields = held !== null && typeof held === 'object' ? (held as Record<string, unknown>) : {};
  return { ...fields, [leaf.tag]: key };
}
