/**
 * Document-wide element index, keyed by `id`.
 *
 * Paint servers (`<linearGradient>`, `<radialGradient>`, `<pattern>`) are
 * referenced by id from anywhere in the document, and SVG places no
 * requirement on where they are *declared* — `<defs>` is a convention, not a
 * rule, and a gradient may also name another gradient it inherits from. Both
 * the gradient and the pattern collectors resolve those references against
 * this index.
 */

/** Element-id → element, for one set of tag names. */
export type ElementTable = Map<string, Element>;

/**
 * Index `root` and every descendant whose lowercased tag name is in `tags`
 * and that carries an `id`. First declaration of a duplicated id wins, which
 * is what a browser's `getElementById` does.
 */
export function collectElementsByTag(root: Element, tags: ReadonlySet<string>): ElementTable {
  const out: ElementTable = new Map();
  const consider = (el: Element): void => {
    if (!tags.has(el.tagName.toLowerCase())) return;
    const id = el.getAttribute('id');
    if (id && !out.has(id)) out.set(id, el);
  };
  consider(root);
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) consider(all[i]);
  return out;
}
