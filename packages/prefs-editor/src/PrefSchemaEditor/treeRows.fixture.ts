/** The key a tree row shows: what its key span holds, and for an unnamed node its whole label. */
export function rowKey(item: Element): string {
  const label = document.getElementById(item.getAttribute('aria-labelledby')!.split(' ')[0]!)!;
  return (label.querySelector('[class*="treeKey"]') ?? label).textContent ?? '';
}

/** The row of `tree` that shows `key`, or `null` when none does. */
export const keyedRow = (tree: Element, key: string): HTMLElement | null =>
  [...tree.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((item) => rowKey(item) === key) ?? null;
