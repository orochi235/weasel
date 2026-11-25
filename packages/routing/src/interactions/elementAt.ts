/** The topmost element at client point (`x`, `y`) in the tree `inTree` belongs to, hit-tested in its shadow root
 *  when it has one, so an element inside one is found rather than its host; `null` where nothing can hit-test. */
export function elementAt(inTree: Node, x: number, y: number): Element | null {
  const root = inTree.getRootNode() as Partial<DocumentOrShadowRoot>;
  const doc = inTree.ownerDocument ?? document;
  const tester = typeof root.elementFromPoint === 'function' ? root : doc;
  return typeof tester.elementFromPoint === 'function' ? tester.elementFromPoint(x, y) : null;
}

/** Whether `inner` is `outer` or inside it, counting what sits in a shadow root as inside its host. */
export function containsComposed(outer: Node, inner: Node): boolean {
  for (let n: Node | null = inner; n; ) {
    if (outer.contains(n)) return true;
    const root = n.getRootNode();
    n = (root as Partial<ShadowRoot>).host ?? null;
  }
  return false;
}
