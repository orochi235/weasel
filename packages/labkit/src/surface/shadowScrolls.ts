import { boxParent } from './clip';

/** Every shadow root holding `el` or one of its ancestors in the flattened tree. */
function shadowRootsAbove(el: Element): Set<ShadowRoot> {
  const roots = new Set<ShadowRoot>();
  for (let n: Element | null = el; n; n = boxParent(n)) {
    const root = n.getRootNode();
    if (root instanceof ShadowRoot) roots.add(root);
  }
  return roots;
}

/**
 * Calls `onScroll` on a scroll inside any shadow root a tile sits under. A scroll event is not composed, so one in a
 * shadow tree never reaches the document's listener. Each root is listened to while some tile under it is placed and
 * the watcher is attached.
 */
export class ShadowScrolls {
  private readonly tiles = new Map<string, Set<ShadowRoot>>();
  private readonly held = new Map<ShadowRoot, number>();
  private attached = false;

  constructor(private readonly onScroll: () => void) {}

  /** Listen under `el` for tile `id`, or with `null` stop. */
  place(id: string, el: HTMLElement | null): void {
    for (const root of this.tiles.get(id) ?? []) {
      const n = (this.held.get(root) ?? 1) - 1;
      if (n > 0) this.held.set(root, n);
      else {
        this.held.delete(root);
        if (this.attached) this.off(root);
      }
    }
    this.tiles.delete(id);
    if (!el) return;
    const roots = shadowRootsAbove(el);
    if (roots.size === 0) return;
    this.tiles.set(id, roots);
    for (const root of roots) {
      const n = this.held.get(root) ?? 0;
      this.held.set(root, n + 1);
      if (n === 0 && this.attached) this.on(root);
    }
  }

  /** Start or stop listening on every root held, keeping which roots those are. */
  setAttached(attached: boolean): void {
    if (attached === this.attached) return;
    this.attached = attached;
    for (const root of this.held.keys()) {
      if (attached) this.on(root);
      else this.off(root);
    }
  }

  private on(root: ShadowRoot): void {
    root.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
  }

  private off(root: ShadowRoot): void {
    root.removeEventListener('scroll', this.onScroll, true);
  }
}
