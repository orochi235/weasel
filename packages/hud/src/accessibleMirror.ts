import type { Hud } from './hud';
import type { HudAccessibleNode, Widget } from './widget';

/** Give `el` the standard visually-hidden declarations. No stylesheet ships with this package. */
export function hideVisually(el: HTMLElement): void {
  Object.assign(el.style, {
    position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0',
    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: '0',
  });
}

let mirrors = 0;

const withoutActive = (n: HudAccessibleNode): unknown =>
  ({ ...n, active: undefined, children: n.children?.map(withoutActive) });

/** The active node's id and its container's, with ids built under `id` as `build` builds them. */
function activeIn(node: HudAccessibleNode, id: string): { id: string; container: string } | null {
  for (const child of node.children ?? []) {
    const childId = `${id}-${child.key}`;
    if (child.active) return { id: childId, container: id };
    const deeper = activeIn(child, childId);
    if (deeper) return deeper;
  }
  return null;
}

/** `node` and its children as elements, with ids under `id`. */
function build(doc: Document, node: HudAccessibleNode, id: string): HTMLElement {
  const el = doc.createElement('div');
  el.id = id;
  el.setAttribute('role', node.role);
  if (node.checked !== undefined) el.setAttribute('aria-checked', String(node.checked));
  if (node.disabled) el.setAttribute('aria-disabled', 'true');
  if (node.expanded !== undefined) {
    el.setAttribute('aria-haspopup', 'menu');
    el.setAttribute('aria-expanded', String(node.expanded));
  }
  if (node.children?.length) {
    if (node.label) el.setAttribute('aria-label', node.label);
    for (const child of node.children) el.appendChild(build(doc, child, `${id}-${child.key}`));
  } else if (node.label) {
    el.textContent = node.label;
  }
  return el;
}

/**
 * Mirror the focused widget's `accessibleTree` as hidden DOM beside `element`, the canvas that
 * holds DOM focus, which owns the mirror (`aria-owns`) and points at its active node
 * (`aria-activedescendant`) for as long as the widget keeps focus. Returns a detach.
 */
export function mirrorFocusedTree(element: HTMLElement, hud: Hud): () => void {
  const doc = element.ownerDocument;
  const prefix = `weasel-hud-a11y-${++mirrors}`;
  let root: HTMLElement | null = null;
  let shape = '';
  let unsubscribe: (() => void) | null = null;

  const clear = () => {
    root?.remove();
    root = null;
    shape = '';
    element.removeAttribute('aria-owns');
    element.removeAttribute('aria-activedescendant');
  };

  // A change of highlight alone moves the active descendant and leaves the elements in place, so
  // assistive tech keeps its place in them.
  const render = (w: Widget) => {
    const node = w.accessibleTree?.read();
    if (!node) { clear(); return; }
    const next = JSON.stringify(withoutActive(node));
    if (!root || next !== shape) {
      clear();
      root = build(doc, node, prefix);
      shape = next;
      hideVisually(root);
      doc.body.appendChild(root);
      element.setAttribute('aria-owns', root.id);
    }
    for (const el of [root, ...root.querySelectorAll('[aria-activedescendant]')]) el.removeAttribute('aria-activedescendant');
    const active = activeIn(node, prefix);
    if (active) {
      doc.getElementById(active.container)?.setAttribute('aria-activedescendant', active.id);
      element.setAttribute('aria-activedescendant', active.id);
    } else {
      element.removeAttribute('aria-activedescendant');
    }
  };

  const follow = (w: Widget | null) => {
    unsubscribe?.();
    unsubscribe = null;
    clear();
    if (!w?.accessibleTree) return;
    unsubscribe = w.accessibleTree.subscribe(() => { if (hud.focused === w) render(w); });
    render(w);
  };

  const unfocus = hud.subscribeFocus(follow);
  follow(hud.focused);
  return () => {
    unfocus();
    unsubscribe?.();
    clear();
  };
}
