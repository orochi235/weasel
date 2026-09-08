/**
 * Reading the `DiagramNode` trait off a scene node.
 *
 * Two ways to attach it, both of which this module's default reader answers:
 *
 *   - **On the node.** `data.diagram` holds the trait. One node, one answer;
 *     what a connect gesture writes when the author drags a new edge.
 *   - **By kind.** A consumer declares once which data shapes take part, and
 *     every matching node gets the trait without being stamped. This mirrors
 *     `createNodeRouting` in the kit — a predicate over `data`, first match
 *     wins — and is the shape to reach for when the participants are a class
 *     of node rather than a hand-picked set.
 *
 * A reader is a plain function, so a consumer whose data lives somewhere else
 * entirely passes their own and never touches either form.
 */
import type { DiagramNode } from './types';

/** The key on a node's `data` the default reader looks under. */
export const DIAGRAM_TRAIT_KEY = 'diagram';

/** All a reader looks at. Deliberately not `SceneNode`: naming `TPose` there
 *  would put it in a contravariant position for no gain, since nothing here
 *  reads a pose. */
export interface DiagramNodeLike {
  id: string;
  kind: 'leaf' | 'container';
  data: unknown;
}

/** Answers "is this node a diagram participant, and on what terms" — `null`
 *  for a node that takes no part. */
export type DiagramNodeReader = (node: DiagramNodeLike) => DiagramNode | null;

/** One class of participant, declared once for every node whose data matches.
 *  Mirrors `NodeRoutingEntry`. */
export interface DiagramNodeEntry {
  /** Unique within a reader; the same vocabulary as `NodeRoutingEntry.name`. */
  name: string;
  matches: (data: unknown) => boolean;
  /** The trait every matching node carries. A function when it varies with the
   *  node's own data — a pipeline stage whose ports come from its rows. */
  trait: DiagramNode | ((data: unknown) => DiagramNode);
}

/** The trait on the node's own `data.diagram`, or `null`.
 *
 *  An edge's trait lives under the same key, so `from` and `to` are what tells
 *  the two apart. Without that test an edge reads as a participant declaring
 *  no ports, and collects the four defaults on the degenerate pose an edge
 *  carries — four grabbable ports in the middle of nowhere. */
export const dataKeyReader: DiagramNodeReader = (node) => {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as Record<string, unknown>)[DIAGRAM_TRAIT_KEY];
  if (trait === null || typeof trait !== 'object') return null;
  if ('from' in trait && 'to' in trait) return null;
  return trait as DiagramNode;
};

/**
 * A reader over declared kinds. A trait on the node's own data still wins, so
 * a single node can opt out of, or override, whatever its kind says.
 *
 * Throws on a duplicate `name`, for the reason `mergeContributions` does: a
 * class of node silently losing its ports is what this registry exists to make
 * loud.
 */
export function createDiagramNodes(entries: readonly DiagramNodeEntry[]): DiagramNodeReader {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.name)) {
      throw new Error(`createDiagramNodes: duplicate entry name "${entry.name}"`);
    }
    seen.add(entry.name);
  }
  return (node) => {
    const own = dataKeyReader(node);
    if (own !== null) return own;
    for (const entry of entries) {
      if (!entry.matches(node.data)) continue;
      return typeof entry.trait === 'function' ? entry.trait(node.data) : entry.trait;
    }
    return null;
  };
}

/** The trait `node` carries, through `read` (default: its own `data.diagram`). */
export function diagramNodeOf(
  node: DiagramNodeLike,
  read: DiagramNodeReader = dataKeyReader,
): DiagramNode | null {
  return read(node);
}

/** True when layout must leave this node where it is. */
export function isPinned(node: DiagramNodeLike, read?: DiagramNodeReader): boolean {
  return diagramNodeOf(node, read)?.pinned === true;
}
