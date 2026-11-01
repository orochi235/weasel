/** How a list that folds is read: which items are branches, which are open, and which item is whose child. */
export interface TreeShape<T> {
  /** Whether `item` can open, its children shown or not. */
  isBranch(item: T): boolean;
  isOpen(item: T): boolean;
  /** Whether `child` is one of `parent`'s own children. */
  isChildOf(child: T, parent: T): boolean;
  /** Whether a branch can open or close now. A disabled one can't. Default: every branch. */
  canToggle?(item: T): boolean;
  /** The inline direction the rows read in. Under `'rtl'` Left opens and Right closes. Default `'ltr'`. */
  dir?: 'ltr' | 'rtl';
}

/** What Right or Left does on one item of a tree: open or close it, move the highlight, or nothing (`handled` false).
 *  `at` null is a key the tree takes without moving. */
export type TreeKeyResult =
  | { handled: false }
  | { handled: true; toggle: number }
  | { handled: true; at: number | null };

/**
 * Right and Left on the item at `at`, the WAI-ARIA tree way: Right opens a closed branch, else steps to its first
 * child; Left closes an open branch, else steps to the parent. Mirrored under `dir: 'rtl'`. `items` are the rows
 * shown, in drawn order.
 */
export function treeKey<T>(items: readonly T[], at: number, key: string, shape: TreeShape<T>): TreeKeyResult {
  const item = items[at];
  if (item === undefined) return { handled: false };
  const canToggle = shape.canToggle?.(item) ?? true;
  const [opens, closes] = shape.dir === 'rtl' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
  if (key === opens) {
    if (!shape.isBranch(item)) return { handled: false };
    if (!shape.isOpen(item)) return canToggle ? { handled: true, toggle: at } : { handled: true, at: null };
    const next = items[at + 1];
    return { handled: true, at: next !== undefined && shape.isChildOf(next, item) ? at + 1 : null };
  }
  if (key !== closes) return { handled: false };
  if (shape.isOpen(item) && canToggle) return { handled: true, toggle: at };
  const parent = items.findIndex((p) => shape.isChildOf(item, p));
  return parent < 0 ? { handled: false } : { handled: true, at: parent };
}
