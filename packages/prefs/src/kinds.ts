import type { PrefKind } from './schema';

/** What a surface has to know about a kind before it can lay its control out. */
export interface PrefKindTraits {
  /** Its value is made of other leaves' values: too much for one control on a
   *  line, so a bar opens it in a popover and a compact panel in a dialog. */
  compound: boolean;
  /** Its control is several controls, or a button. A row drawn as a `<label>`
   *  would hand a click on its text to the first of them. */
  several: boolean;
}

const ONE: PrefKindTraits = { compound: false, several: false };
const MANY: PrefKindTraits = { compound: true, several: true };

/**
 * The traits of every built-in kind. A `Record` over {@link PrefKind}, so a
 * kind added to the union does not compile until it says what it is here:
 * a plain set of kind names lets a new one through to draw inline in a
 * `<label>`, on a bar's line, and with no dialog row.
 */
export const PREF_KIND_TRAITS: Record<PrefKind, PrefKindTraits> = {
  number: ONE,
  boolean: ONE,
  string: ONE,
  enum: ONE,
  color: ONE,
  paint: ONE,
  object: MANY,
  list: MANY,
  map: MANY,
  union: MANY,
  field: ONE,
  action: { compound: false, several: true },
  alias: ONE,
  label: ONE,
  separator: ONE,
};

const traitsOf = (leaf: { kind: string }): PrefKindTraits =>
  (Object.hasOwn(PREF_KIND_TRAITS, leaf.kind) ? PREF_KIND_TRAITS[leaf.kind as PrefKind] : ONE);

/** Whether a leaf's value is made of other leaves' values. An app-defined kind is not: its renderer is one control. */
export function prefIsCompound(leaf: { kind: string }): boolean {
  return traitsOf(leaf).compound;
}

/** Whether a leaf's control is several controls or a button. */
export function prefDrawsSeveral(leaf: { kind: string }): boolean {
  return traitsOf(leaf).several;
}
