/**
 * The tree both input registries hang on. A provider is a root; every canvas
 * mounts a scope under the registry in scope; a yoke sits between the two. A
 * registration lives in the node it was made in, and a lookup starts at a leaf
 * and walks up, so one canvas never answers for another.
 *
 * Design: docs/proposals/2026-09-27-input-scopes.md.
 */

/** What every node of one tree shares: a version and the listeners to it. */
export interface ScopeTree {
  version: number;
  readonly listeners: Set<() => void>;
}

export class ScopeNode<N extends ScopeNode<N>> {
  readonly tree: ScopeTree;
  private readonly children: N[] = [];
  private activeChild: N | null = null;

  /** `descends`: whether reads made here answer from the active child down —
   *  true for a root or a yoke, which chrome reads through; false for a scope,
   *  which answers for itself even with a scope nested inside it. */
  constructor(readonly parent: N | null, readonly descends: boolean) {
    this.tree = parent ? parent.tree : { version: 0, listeners: new Set() };
  }

  /** Bump the tree's version and tell every listener in it. */
  changed(): void {
    this.tree.version++;
    for (const listener of this.tree.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('weasel input scope: subscriber threw', err);
      }
    }
  }

  /** Join the parent's children, newest last; returns the leave. */
  mount(): () => void {
    const parent = this.parent;
    if (!parent) return () => {};
    parent.children.push(this as unknown as N);
    this.changed();
    let left = false;
    return () => {
      if (left) return;
      left = true;
      const i = parent.children.lastIndexOf(this as unknown as N);
      if (i !== -1) parent.children.splice(i, 1);
      if (parent.activeChild === (this as unknown as N)) parent.activeChild = null;
      this.changed();
    };
  }

  /** Make this node the one its ancestors resolve through. */
  activate(): void {
    let moved = false;
    for (let n = this as unknown as N; n.parent; n = n.parent) {
      if (n.parent.activeChild !== n) {
        n.parent.activeChild = n;
        moved = true;
      }
    }
    if (moved) this.changed();
  }

  /** The node a lookup made here starts from: down the active children, or the
   *  newest where nothing has been activated yet. A yoke with no members yet
   *  is passed over — there is no canvas behind it to answer. */
  leaf(): N {
    let n = this as unknown as N;
    for (;;) {
      const next: N | null = n.activeChild ?? n.newestMember();
      if (!next) return n;
      n = next;
    }
  }

  private newestMember(): N | null {
    for (let i = this.children.length - 1; i >= 0; i--) {
      const c = this.children[i]!;
      if (!(c.descends && c.children.length === 0)) return c;
    }
    return null;
  }

  /** Where a read made through this node starts. */
  start(): N {
    return this.descends ? this.leaf() : (this as unknown as N);
  }

  /** Whether this node is on the path a read from the root takes. */
  isActive(): boolean {
    let root = this as unknown as N;
    while (root.parent) root = root.parent;
    for (const n of root.leaf().chain()) if (n === (this as unknown as N)) return true;
    return false;
  }

  /** This node, then each ancestor up to the root. */
  *chain(): Generator<N> {
    for (let n: N | null = this as unknown as N; n; n = n.parent) yield n;
  }
}

/**
 * Push `value` onto an owner stack and hand back its release.
 *
 * Newest wins, but the release takes out *its own* entry wherever it now sits,
 * so a displaced owner leaving cannot disturb the one above it. A `null` value
 * registers nothing and releases to a no-op. Double-release safe.
 */
export function pushOwner<T>(stack: T[], value: T | null): () => void {
  if (value === null) return () => {};
  stack.push(value);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const i = stack.lastIndexOf(value);
    if (i !== -1) stack.splice(i, 1);
  };
}
