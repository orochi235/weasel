import type { PrefValueBase, PrefLeaf } from './schema';

/**
 * A leaf whose value is an array, every entry described by `item`.
 *
 * `item` is an ordinary leaf, built-in or app-defined, so a list of objects,
 * of lists or of a custom kind is declared the way a list of numbers is, and
 * each entry is validated and drawn as that leaf would be on its own. Its
 * `default` is what a new entry starts as, and its `name` names one entry
 * (`'Phase'` under a list named `'Phases'`).
 */
export interface PrefList extends PrefValueBase<'list', readonly unknown[]> {
  item: PrefLeaf;
  /** A stored list shorter than this reads as the default, and a UI stops removing at it. */
  minItems?: number;
  /** A stored list longer than this reads cut to it, and a UI stops adding at it. */
  maxItems?: number;
  control?: PrefListControl;
}

/**
 * How a schema-driven UI should present a list whose entries are plain text: a field per entry, one under another,
 * or `tokens`, a chip per entry in a row that wraps, for entries short enough to read as one. A list of anything else
 * is drawn a control per entry whatever this says.
 */
export type PrefListControl = 'list' | 'tokens';
