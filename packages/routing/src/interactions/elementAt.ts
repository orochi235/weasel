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

/** The topmost element at client point (`x`, `y`) as laid out: {@link elementAt}, then down through each shadow
 *  root the hit hosts, so an element inside one is found rather than its host. */
export function deepElementAt(inTree: Node, x: number, y: number): Element | null {
  let el = elementAt(inTree, x, y);
  for (let root = el?.shadowRoot; root && typeof root.elementFromPoint === 'function'; root = el?.shadowRoot) {
    const inner = root.elementFromPoint(x, y);
    if (!inner || inner === el) break;
    el = inner;
  }
  return el;
}

/** The parent `n` is laid out in: its slot when it is slotted, the host when its parent is a shadow root. */
export function flatParentOf(n: Node): Element | null {
  const slot = (n as Partial<Element>).assignedSlot;
  if (slot) return slot;
  if (n.parentElement) return n.parentElement;
  const p = n.parentNode;
  // Only a shadow root's `host` is a node: a detached `<a>` topping its subtree has a URL string there.
  return p?.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? (p as Partial<ShadowRoot>).host ?? null : null;
}

/** Whether `inner` is `outer` or inside it as laid out: what sits in a shadow root counts as inside its host, and
 *  what is slotted counts as inside its slot. */
export function containsComposed(outer: Node, inner: Node): boolean {
  for (let n: Node | null = inner; n; n = flatParentOf(n)) if (outer.contains(n)) return true;
  return false;
}
