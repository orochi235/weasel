import type { PrefLeaf } from './schema';

/**
 * `leaf` as a named type: the same leaf carrying `name` in its `type` field.
 * Declared once beside the code that reads its value and used wherever a
 * schema wants one, spread with what that place sets for itself
 * (`{ ...GradientStop, name: 'First stop' }`), or as a list's or a map's
 * `item`. `name` is the identifier the type is exported under, which a schema
 * editor prints in place of the leaf's literal.
 */
export function prefType<L extends PrefLeaf>(name: string, leaf: L): L & { type: string } {
  return { ...leaf, type: name };
}
