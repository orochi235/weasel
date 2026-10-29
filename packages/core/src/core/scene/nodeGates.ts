/**
 * Whether a node is shown, and whether it is in reach — the one place either
 * question is answered. Painting, picking, area selection, select-all,
 * snapping, export, and the scene's own lock guard all ask here.
 *
 * - **Hidden**: its own layer is not visible, or it or any ancestor carries
 *   `hidden`. A layer hides only the nodes tagged to it; a hidden node hides
 *   its whole subtree, as SVG's `display="none"` does.
 * - **Locked**: it or any ancestor carries `locked`, or sits on a locked
 *   layer. A lock covers the whole subtree, whatever layers it spans.
 */
import type { NodeId } from './types';

/** The node fields the gates read. A partial scene stand-in may leave `parent` out. */
export interface GatedNode {
  readonly layer: string;
  readonly parent?: string | null;
  readonly hidden?: boolean;
  readonly locked?: boolean;
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

/** Both answers, for one read of a scene. */
export interface NodeGates {
  /** Whether `id` is not drawn. An id not in the scene is not hidden. */
  hidden(id: string): boolean;
  /** Whether `id` is out of reach. An id not in the scene is not locked. */
  locked(id: string): boolean;
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
    : (node: GatedNode) => node.locked === true || lockedLayers.has(node.layer);

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
      const node = scene.get(id as NodeId);
      if (node === undefined) return false;
      return hiddenLayers?.has(node.layer) === true || hidesSubtree(node) || hiddenAbove(node.parent ?? null);
    },
    locked(id) {
      const node = scene.get(id as NodeId);
      if (node === undefined) return false;
      return ownLock(node) || lockedAbove(node.parent ?? null);
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
  return climbs(scene, id, layers === null
    ? (node) => node.locked === true
    : (node) => node.locked === true || layers.has(node.layer));
}
