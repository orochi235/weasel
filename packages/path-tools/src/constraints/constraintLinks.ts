/**
 * Constraints between nodes. A link is a node of its own: its `dependsOn`
 * names the nodes it ties, in order, and its `data.constraintLink` holds one
 * `PathConstraint` whose anchors are numbered over theirs one after another —
 * with two nodes of 4 and 5 anchors, anchor 6 is the second node's anchor 2.
 * Being a node, it is saved and undone with the scene, and deleting a node it
 * ties deletes it too. It draws nothing and takes no clicks; keep it on a
 * layer that is not exported, such as an annotation layer.
 *
 * An edit of any node a link ties solves every node the links reach in one
 * solve: an anchor held on another node's segment slides along it when
 * dragged and follows it when that node is edited.
 */
import {
  constrainPathsEdit,
  type PathConstraint,
  type PathLink,
  type PathsEditItem,
  type PointOrigin,
  type PolygonPath,
} from '@weasel-js/geom';
import {
  registerNodeShape,
  type AddNodeSpec, type NodeId, type NodeShapeEntry, type PathEditFinishCtx, type PathEditOther, type RectPose,
} from '@weasel-js/core';
import { constraintAxisOf, constraintsOf } from './pathConstraints';

/** What a link node keeps in `data`. */
export interface ConstraintLinkData {
  constraintLink: PathConstraint;
}

/** The constraint `data` holds as a link, or null when it is not one. */
export function constraintLinkOf(data: unknown): PathConstraint | null {
  const c = (data as Partial<ConstraintLinkData> | null | undefined)?.constraintLink;
  return c && typeof c === 'object' && typeof c.kind === 'string' ? c : null;
}

/** The painter for link nodes: they draw nothing, have no outline to pick, and take no room. */
export const CONSTRAINT_LINK_SHAPE: NodeShapeEntry = {
  id: 'path-tools:constraint-link',
  matches: (node) => constraintLinkOf(node.data) !== null,
  paint: () => [],
  bounds: () => null,
};

let linkShapeRegistered = false;

/** Register {@link CONSTRAINT_LINK_SHAPE} ahead of the kit's painters, once. */
export function registerConstraintLinkShape(): void {
  if (linkShapeRegistered) return;
  linkShapeRegistered = true;
  registerNodeShape(CONSTRAINT_LINK_SHAPE, { priority: 'high' });
}

/** Options for {@link constraintLinkNode}. */
export interface ConstraintLinkNodeOptions<TPose> {
  layer: string;
  /** The nodes it ties, in the order its anchors number them. */
  nodes: readonly string[];
  constraint: PathConstraint;
  id?: string;
  /** Default: an empty box at the origin. */
  pose?: TPose;
}

/** A link node, ready for `scene.add`. Registers the painter that keeps link nodes from drawing. */
export function constraintLinkNode<TPose = RectPose>(
  opts: ConstraintLinkNodeOptions<TPose>,
): AddNodeSpec<ConstraintLinkData, string, TPose> {
  registerConstraintLinkShape();
  return {
    kind: 'leaf',
    layer: opts.layer,
    pose: opts.pose ?? ({ x: 0, y: 0, width: 0, height: 0 } as TPose),
    data: { constraintLink: opts.constraint },
    dependsOn: opts.nodes as NodeId[],
    pickable: false,
    ...(opts.id ? { id: opts.id as NodeId } : {}),
  };
}

interface Link {
  id: string;
  nodes: readonly string[];
  constraint: PathConstraint;
}

function linkAt(ctx: PathEditFinishCtx, id: string): Link | null {
  const node = ctx.node(id);
  const constraint = constraintLinkOf(node?.data);
  const nodes = node?.dependsOn;
  return constraint && Array.isArray(nodes) ? { id, nodes, constraint } : null;
}

/** Every link reached from `start` through the nodes links tie, and those nodes, `start` first. */
function linkedFrom(ctx: PathEditFinishCtx, start: string): { nodes: string[]; links: Link[] } {
  const nodes = [start];
  const links = new Map<string, Link>();
  for (let k = 0; k < nodes.length; k++) {
    for (const id of ctx.dependents(nodes[k])) {
      const link = links.has(id) ? null : linkAt(ctx, id);
      if (!link) continue;
      links.set(id, link);
      for (const n of link.nodes) if (!nodes.includes(n)) nodes.push(n);
    }
  }
  return { nodes, links: [...links.values()] };
}

const same = (a: readonly PathConstraint[], b: readonly PathConstraint[]) =>
  a.length === b.length && a.every((c, i) => JSON.stringify(c) === JSON.stringify(b[i]));

/** What {@link finishLinkedEdit} answers. */
export interface LinkedEdit {
  path: PolygonPath;
  constraints: readonly PathConstraint[];
  others: PathEditOther[];
}

/**
 * `worldPath`, an edit of `ctx.id`, finished with every node links reach from
 * it solved alongside: its path, its own constraints renumbered, and the
 * other nodes and links that change with it. Undefined when no link reaches
 * it; null when the constraints cannot hold.
 */
export function finishLinkedEdit(
  ctx: PathEditFinishCtx,
  worldPath: PolygonPath,
  origins?: readonly (PointOrigin | null)[],
): LinkedEdit | null | undefined {
  const { nodes, links } = linkedFrom(ctx, ctx.id);
  if (links.length === 0) return undefined;
  const items: PathsEditItem[] = [];
  for (const [k, id] of nodes.entries()) {
    const node = ctx.node(id);
    const before = ctx.path(id);
    if (!node || !before) return undefined;
    items.push({
      before,
      after: k === 0 ? worldPath : before,
      constraints: constraintsOf(node.data),
      axisAngle: constraintAxisOf(node),
      ...(k === 0 ? { origins } : {}),
    });
  }
  const pathLinks: PathLink[] = links.map((l) => ({ constraint: l.constraint, paths: l.nodes.map((n) => nodes.indexOf(n)) }));
  const done = constrainPathsEdit(items, pathLinks);
  if (!done.converged) return null;
  const others: PathEditOther[] = [];
  done.items.forEach((item, k) => {
    if (k === 0) return;
    const had = constraintsOf(ctx.node(nodes[k])?.data);
    const changed = !same(had, item.constraints);
    if (item.path !== items[k].after || changed) {
      others.push({ id: nodes[k], path: item.path, ...(changed ? { data: { constraints: item.constraints } } : {}) });
    }
  });
  done.links.forEach((l, k) => {
    const link = links[k];
    if (!l.constraint) others.push({ id: link.id, remove: true });
    else if (JSON.stringify(l.constraint) !== JSON.stringify(link.constraint)) {
      others.push({ id: link.id, data: { constraintLink: l.constraint } });
    }
  });
  const own = constraintsOf(ctx.node(ctx.id)?.data);
  const [first] = done.items;
  return { path: first.path, constraints: same(own, first.constraints) ? own : first.constraints, others };
}
