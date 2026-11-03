/**
 * Whether a node is shown, and whether it is in reach — the one place either
 * question is answered. Painting, picking, area selection, select-all,
 * snapping, export, and the scene's own lock guard all ask here.
 *
 * - **Hidden**: its own layer is not visible, or it or any ancestor carries
 *   `hidden`. A layer hides only the nodes tagged to it; a hidden node hides
 *   its whole subtree, as SVG's `display="none"` does.
 * - **Locked**: it or any ancestor carries `locked`, or sits on a locked
 *   layer. A lock covers the whole subtree, whatever layers it spans. A page
 *   or the page run ignores layer locks: only its own `locked` counts, so
 *   locking the paper's layer neither locks the pages nor what is on them.
 * - **Structure**: it is a page or the page run. Drawn, and its content is
 *   in reach, but the node itself is never selected, picked, deleted,
 *   copied, grouped or dropped into by the ordinary scene tools; page edits
 *   go through the page API. Its own answer only, not its subtree's.
 */
import type { NodeId, Scene } from './types';

/** The node fields the gates read. A partial scene stand-in may leave `parent` out. */
export interface GatedNode {
  readonly layer: string;
  readonly parent?: string | null;
  readonly hidden?: boolean;
  readonly locked?: boolean;
  readonly page?: unknown;
  readonly pageRun?: unknown;
}

/** The layer fields the gates read. Only an explicit `visible: false` hides. */
export interface GatedLayer {
  readonly id: string;
  readonly visible?: boolean;
  readonly locked?: boolean;
}

/** What the gates read of a scene. A `Scene` is one. */
export interface GateSource {
  readonly layers?: readonly GatedLayer[];
  get(id: NodeId): GatedNode | undefined;
}

/** Whether `node`'s own flag hides it and its subtree. A walk from the roots
 *  down prunes where this holds instead of asking {@link NodeGates.hidden}
 *  per node; the two agree because this is the flag that answer climbs for. */
export function hidesSubtree(node: { readonly hidden?: boolean }): boolean {
  return node.hidden === true;
}

/** Whether `node` is page structure: a page or the page run. See the module comment. */
export function isPageStructure(node: { readonly page?: unknown; readonly pageRun?: unknown } | undefined): boolean {
  return node !== undefined && (node.page !== undefined || node.pageRun !== undefined);
}

/** `ids` less pages and the page run, or `ids` itself when it holds neither: the ids a scene action
 *  reads off a selection, which a caller's own selection api may have filled with anything. */
export function withoutPageStructure<T extends string>(scene: GateSource, ids: readonly T[]): readonly T[] {
  const out = (id: T) => isPageStructure(scene.get(id as string as NodeId));
  return ids.some(out) ? ids.filter((id) => !out(id)) : ids;
}

/** The tops of what a document holds, from `ids` (default the scene's roots): each id, but the page run and each
 *  page by what they hold, in order. What a file writes, since it places content in the world and lists its
 *  pages apart. */
export function contentRoots<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  ids: readonly (NodeId | string)[] = scene.roots,
): NodeId[] {
  return ids.flatMap((id) => isPageStructure(scene.get(id as NodeId))
    ? contentRoots(scene, scene.childrenOf(id as NodeId))
    : [id as NodeId]);
}

/** The answers, for one read of a scene. Each takes an id, or the node a
 *  walk already holds, which saves looking it up. */
export interface NodeGates {
  /** Whether `id` is not drawn. An id not in the scene is not hidden. */
  hidden(id: string | GatedNode): boolean;
  /** Whether `id` is out of reach. An id not in the scene is not locked. */
  locked(id: string | GatedNode): boolean;
  /** Whether `id` is page structure ({@link isPageStructure}). */
  structure(id: string | GatedNode): boolean;
}

/**
 * The gates over `scene` as it stands now. Ancestor answers are remembered,
 * so a walk over every node climbs each chain once: build one per walk, and
 * a fresh one after an edit.
 */
export function nodeGates(scene: GateSource): NodeGates {
  const hiddenLayers = flaggedLayers(scene, 'hidden');
  const lockedLayers = flaggedLayers(scene, 'locked');
  const ownLock = lockedLayers === null
    ? (node: GatedNode) => node.locked === true
    : (node: GatedNode) => node.locked === true || (!isPageStructure(node) && lockedLayers.has(node.layer));

  /** Whether `test` holds on the node at `parent` or any of its ancestors.
   *  Only ancestors are remembered, so a walk over a flat scene allocates
   *  nothing; that walk is every pick made after an edit. */
  const above = (test: (node: GatedNode) => boolean) => {
    const memo = new Map<string, boolean>();
    const path: string[] = [];
    return (parent: string | null): boolean => {
      if (parent === null) return false;
      let out = false;
      let seen: Set<string> | null = null;
      path.length = 0;
      for (let at: string | null = parent; at !== null; ) {
        const known = memo.get(at);
        if (known !== undefined) { out = known; break; }
        const node = scene.get(at as NodeId);
        if (node === undefined) break;
        if (path.length > 64) {
          seen ??= new Set(path);
          if (seen.has(at)) break;
          seen.add(at);
        }
        path.push(at);
        if (test(node)) { out = true; break; }
        at = node.parent ?? null;
      }
      for (const id of path) memo.set(id, out);
      return out;
    };
  };

  const hiddenAbove = above(hidesSubtree);
  const lockedAbove = above(ownLock);
  return {
    hidden(id) {
      const node = typeof id === 'string' ? scene.get(id as NodeId) : id;
      if (node === undefined) return false;
      if (hidesSubtree(node) || (hiddenLayers !== null && hiddenLayers.has(node.layer))) return true;
      const parent = node.parent;
      return parent !== undefined && parent !== null && hiddenAbove(parent);
    },
    locked(id) {
      const node = typeof id === 'string' ? scene.get(id as NodeId) : id;
      if (node === undefined) return false;
      if (ownLock(node)) return true;
      const parent = node.parent;
      return parent !== undefined && parent !== null && lockedAbove(parent);
    },
    structure(id) {
      return isPageStructure(typeof id === 'string' ? scene.get(id as NodeId) : id);
    },
  };
}

/** Whether `test` holds on the node at `id` or any ancestor, without the
 *  allocation {@link nodeGates} spends on a walk: the scene's lock guard asks
 *  this on every mutation. A parent cycle answers false, as the walk's does. */
function climbs(scene: GateSource, id: string, test: (node: GatedNode) => boolean): boolean {
  let seen: Set<string> | null = null;
  let hops = 0;
  for (let at: string | null = id; at !== null; ) {
    const node = scene.get(at as NodeId);
    if (node === undefined) return false;
    if (++hops > 64) {
      seen ??= new Set();
      if (seen.has(at)) return false;
      seen.add(at);
    }
    if (test(node)) return true;
    at = node.parent ?? null;
  }
  return false;
}

/** The layers flagged `flag`, or null when none is: the usual answer, which
 *  lets a climb skip the layer test at every hop. */
function flaggedLayers(scene: GateSource, flag: 'locked' | 'hidden'): Set<string> | null {
  let out: Set<string> | null = null;
  for (const l of scene.layers ?? []) {
    if (flag === 'locked' ? l.locked === true : l.visible === false) (out ??= new Set()).add(l.id);
  }
  return out;
}

/** {@link NodeGates.hidden} for one id. */
export function isNodeHidden(scene: GateSource, id: NodeId): boolean {
  const node = scene.get(id);
  if (node === undefined) return false;
  return flaggedLayers(scene, 'hidden')?.has(node.layer) === true || climbs(scene, id, hidesSubtree);
}

/** {@link NodeGates.locked} for one id. */
export function isNodeLocked(scene: GateSource, id: NodeId): boolean {
  const layers = flaggedLayers(scene, 'locked');
  if (layers === null) return climbs(scene, id, (node) => node.locked === true);
  return climbs(scene, id, (node) => node.locked === true || (!isPageStructure(node) && layers.has(node.layer)));
}
