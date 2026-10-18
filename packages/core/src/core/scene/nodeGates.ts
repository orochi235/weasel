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
  const hiddenLayers = new Set<string>();
  const lockedLayers = new Set<string>();
  for (const l of scene.layers ?? []) {
    if (l.visible === false) hiddenLayers.add(l.id);
    if (l.locked === true) lockedLayers.add(l.id);
  }

  /** Whether `flag` holds on the node at `id` or any ancestor, the node's
   *  layer counting when `layers` holds it. */
  const inherited = (flag: 'hidden' | 'locked', layers: Set<string> | null) => {
    const memo = new Map<string, boolean>();
    const climb = (id: string, seen: Set<string>): boolean => {
      const known = memo.get(id);
      if (known !== undefined) return known;
      const node = scene.get(id as NodeId);
      if (node === undefined || seen.has(id)) return false;
      seen.add(id);
      const parent = node.parent ?? null;
      const out = (flag === 'hidden' ? hidesSubtree(node) : node.locked === true)
        || (layers !== null && layers.has(node.layer))
        || (parent !== null && climb(parent, seen));
      memo.set(id, out);
      return out;
    };
    return (id: string) => climb(id, new Set());
  };

  const flaggedHidden = inherited('hidden', null);
  const locked = inherited('locked', lockedLayers);
  return {
    hidden(id) {
      const node = scene.get(id as NodeId);
      if (node === undefined) return false;
      return hiddenLayers.has(node.layer) || flaggedHidden(id);
    },
    locked,
  };
}

/** {@link NodeGates.hidden} for one id. */
export function isNodeHidden(scene: GateSource, id: NodeId): boolean {
  return nodeGates(scene).hidden(id);
}

/** {@link NodeGates.locked} for one id. */
export function isNodeLocked(scene: GateSource, id: NodeId): boolean {
  return nodeGates(scene).locked(id);
}
