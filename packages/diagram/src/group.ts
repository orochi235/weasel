/**
 * A group's box, and anything pinned to a point on another node.
 *
 * The box is an ordinary node that depends on its members and derives its pose
 * from theirs: their union, grown by the inset. Drag a member and the box
 * follows; lay the diagram out and the box lands around wherever the members
 * went. Nothing has to keep it in sync, because nothing stores it.
 *
 * An anchored node — a group's title is the first — derives its pose from one
 * dependency's bounds the same way, so it travels with the box it labels.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  translatePoseViaDescriptor,
  type DerivedDep,
  type PoseDescriptor,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { insetOf } from './cluster';
import { DIAGRAM_TRAIT_KEY } from './trait';
import type { DiagramGroup, PortAnchor } from './types';

/** Where an anchored node sits on its dependency. */
export interface DiagramAnchor {
  /** The point on the dependency's bounds, normalized as a port's is. */
  at: PortAnchor;
  /** The point on the node's own bounds that lands there. Default `at`, so
   *  `{ u: 0, v: 0 }` puts the node's top-left on the dependency's. */
  self?: PortAnchor;
  /** Then moved by this much, in world units. */
  offset?: Vec2;
}

function traitOf(node: { data: unknown }): Record<string, unknown> | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as Record<string, unknown>)[DIAGRAM_TRAIT_KEY];
  return trait !== null && typeof trait === 'object' ? (trait as Record<string, unknown>) : null;
}

/** The group trait on a node's data, or `null`. */
export function diagramGroupOf(node: { data: unknown }): DiagramGroup | null {
  const group = traitOf(node)?.group;
  return group !== null && typeof group === 'object' ? (group as DiagramGroup) : null;
}

/** The anchor trait on a node's data, or `null`. */
export function diagramAnchorOf(node: { data: unknown }): DiagramAnchor | null {
  const anchor = traitOf(node)?.anchor;
  return anchor !== null && typeof anchor === 'object' && 'at' in anchor ? (anchor as DiagramAnchor) : null;
}

/** Options for {@link groupDerivePose} and {@link anchorDerivePose}.
 *  `geometry` defaults to the kit's `AUTO_POSE_DESCRIPTOR`. */
export interface GroupPoseOptions<TPose> {
  geometry?: PoseDescriptor<TPose>;
}

type DerivePose<TPose> = (
  node: { pose: TPose; data: unknown },
  deps: readonly (DerivedDep<TPose> | undefined)[],
) => TPose | null;

/**
 * A `derivePose` that draws a group's box around its members: their union,
 * grown by the trait's inset. `null` — the authored pose stands — when the node
 * carries no group trait or every member is gone.
 */
export function groupDerivePose<TPose>(opts: GroupPoseOptions<TPose> = {}): DerivePose<TPose> {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  return (node, deps) => {
    const group = diagramGroupOf(node);
    if (group === null) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const dep of deps) {
      if (dep === undefined) continue;
      const b = geometry.getBounds(dep.pose);
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.width);
      y1 = Math.max(y1, b.y + b.height);
    }
    if (!Number.isFinite(x0)) return null;
    const inset = insetOf(group.inset);
    return geometry.fromBounds(
      {
        x: x0 - inset.left,
        y: y0 - inset.top,
        width: x1 - x0 + inset.left + inset.right,
        height: y1 - y0 + inset.top + inset.bottom,
      },
      node.pose,
    );
  };
}

/**
 * A `derivePose` that keeps a node at a point on its dependency's bounds.
 * `null` when the node carries no anchor trait or the dependency is gone.
 */
export function anchorDerivePose<TPose>(opts: GroupPoseOptions<TPose> = {}): DerivePose<TPose> {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  return (node, deps) => {
    const anchor = diagramAnchorOf(node);
    const dep = deps[0];
    if (anchor === null || dep === undefined) return null;
    const target = geometry.getBounds(dep.pose);
    const own = geometry.getBounds(node.pose);
    const self = anchor.self ?? anchor.at;
    const x = target.x + anchor.at.u * target.width + (anchor.offset?.x ?? 0) - self.u * own.width;
    const y = target.y + anchor.at.v * target.height + (anchor.offset?.y ?? 0) - self.v * own.height;
    return translatePoseViaDescriptor(node.pose, x - own.x, y - own.y, geometry);
  };
}

/** Registry key for {@link GROUP_DERIVE_POSE}. */
export const DIAGRAM_GROUP = 'diagram:group';
/** Registry key for {@link ANCHOR_DERIVE_POSE}. */
export const DIAGRAM_ANCHOR = 'diagram:anchor';

/** The default derivations, as stable references so `toJSON` can find their keys. */
export const GROUP_DERIVE_POSE = groupDerivePose<unknown>();
export const ANCHOR_DERIVE_POSE = anchorDerivePose<unknown>();
