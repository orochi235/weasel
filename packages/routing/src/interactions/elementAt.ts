/** The topmost element at client point (`x`, `y`) in the tree `inTree` belongs to, hit-tested in its shadow root
 *  when it has one, so an element inside one is found rather than its host; `null` where nothing can hit-test. */
export function elementAt(inTree: Node, x: number, y: number): Element | null {
  return testerOf(inTree)?.elementFromPoint(x, y) ?? null;
}

/** Whether the tree `inTree` belongs to can hit-test, so that a `null` from {@link elementAt} means nothing on the
 *  page is at the point (past the viewport's edge, say) rather than that nothing could tell. */
export function canHitTest(inTree: Node): boolean {
  return testerOf(inTree) !== null;
}

function testerOf(inTree: Node): Pick<DocumentOrShadowRoot, 'elementFromPoint'> | null {
  const root = inTree.getRootNode() as Partial<DocumentOrShadowRoot>;
  if (typeof root.elementFromPoint === 'function') return root as DocumentOrShadowRoot;
  const doc: Partial<DocumentOrShadowRoot> = inTree.ownerDocument ?? document;
  return typeof doc.elementFromPoint === 'function' ? (doc as DocumentOrShadowRoot) : null;
}

/** Whether `inner` is `outer` or inside it, counting what sits in a shadow root as inside its host. */
export function containsComposed(outer: Node, inner: Node): boolean {
  for (let n: Node | null = inner; n; ) {
    if (outer.contains(n)) return true;
    const root = n.getRootNode();
    // Only a shadow root's `host` is a node: a detached `<a>` topping its subtree has a URL string there.
    n = root.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? (root as Partial<ShadowRoot>).host ?? null : null;
  }
  return false;
}

/** `el`'s parent in the flat tree, which is the one its box is laid out in: the slot it is assigned to, else its
 *  parent, else the host of the shadow root it tops. */
export const flatParentOf = (el: Element): Element | null =>
  el.assignedSlot ?? el.parentElement ?? (el.parentNode as Partial<ShadowRoot> | null)?.host ?? null;
