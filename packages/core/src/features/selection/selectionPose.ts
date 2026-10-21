/**
 * The pose and box a selection's chrome is drawn around: precedence between
 * the in-flight overlays and the stored pose, a container's union over its
 * leaves, and the drawn box a scene supplies.
 */
import type { Scale2 } from '@weasel-js/geom';
import { drawnAABBOf, drawnBoundsOf, type DrawnBoundsScene } from 'canvas/drawnBounds';
import { unionAABB } from 'core/geometry/unionBounds';
import { framedBounds, visualBoundsViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { NodeId } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/**
 * Transitive leaf ids under `id`. A childless node is a leaf only if it is not
 * itself a container: an empty container contributes no bounds, and its own
 * stored pose is at its most stale when no children are left to have moved it.
 */
function leavesOf(
  id: string,
  getChildren: (id: string) => readonly string[],
  isContainer: (id: string) => boolean,
): string[] {
  if (!isContainer(id)) return [id];
  const out: string[] = [];
  const visit = (nid: string) => {
    const kids = getChildren(nid);
    if (kids.length === 0) { if (!isContainer(nid)) out.push(nid); return; }
    for (const k of kids) visit(k);
  };
  visit(id);
  return out;
}

/** How one id's pose becomes a box: the pose box, or with a scene the box the
 *  node is drawn with. Each id is read as a leaf — the pose already says where
 *  a container is, so its members' stored poses are not consulted again. */
function boxReader<TPose>(
  d: PoseDescriptor<TPose>,
  scene: DrawnBoundsScene | undefined,
): { framed(id: string, pose: TPose, scale?: number | Scale2): Bounds; aabb(id: string, pose: TPose, scale?: number | Scale2): Bounds } {
  if (!scene) {
    return {
      framed: (_id, pose) => framedBounds(pose, d),
      aabb: (_id, pose) => visualBoundsViaDescriptor(pose, d),
    };
  }
  const leaves: DrawnBoundsScene = {
    get: (id) => scene.get(id),
    ...(scene.derivedPathOf ? { derivedPathOf: (id: NodeId) => scene.derivedPathOf!(id) } : {}),
  };
  const opts = (scale: number | Scale2 | undefined) => ({
    descriptor: d as PoseDescriptor<unknown>,
    ...(scale !== undefined ? { scale } : {}),
  });
  return {
    framed: (id, pose, scale) => drawnBoundsOf(leaves, id as NodeId, pose, opts(scale)),
    aabb: (id, pose, scale) => drawnAABBOf(leaves, id as NodeId, pose, opts(scale)),
  };
}

/** Options for `composeSelectionPose`. */
export interface ComposeSelectionPoseOpts<TPose> {
  /** Move overlay; when present its `poses` map wins over everything else. */
  moveOverlay?: { poses: Map<string, TPose> } | null;
  /**
   * Resize overlay; consulted only when move overlay does not own the id.
   * For container resize, `leafPoses` (when present) maps each leaf id under
   * the container to its overlay pose. If absent the container falls back to
   * stored leaf poses.
   */
  resizeOverlay?: {
    id: string;
    currentPose: TPose;
    leafPoses?: Map<string, TPose>;
  } | null;
  /** Fallback pose lookup (typically the stored/committed pose). */
  getStoredPose: (id: string) => TPose;
  /** How to read poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  /** Walk a container's direct children (e.g. `scene.childrenOf`). With
   *  `isContainer`, a selected container resolves to the union AABB of its
   *  transitive leaf poses instead of its own stored pose. */
  getChildren?: (id: string) => readonly string[];
  /** True when `id` is a structural container. */
  isContainer?: (id: string) => boolean;
  /** The nodes behind the ids. With it, a container's union takes each leaf
   *  as drawn, stroke included (`drawnBoundsOf`); without, its pose box. */
  scene?: DrawnBoundsScene;
  /** View scale a screen-pixel stroke is resolved at. Default 1. */
  viewScale?: () => number | Scale2;
}

/**
 * Build a pose resolver for a selection. Precedence per id:
 * move overlay > resize overlay > stored. When `getChildren`/`isContainer`
 * are supplied and the id resolves to a container, the resolver returns the
 * union AABB of all transitive leaf poses (each leaf still subject to the
 * precedence rules). Containers with no leaves resolve to `null`.
 */
export function composeSelectionPose<TPose>(
  opts: ComposeSelectionPoseOpts<TPose>,
): (id: string) => TPose | null {
  const { moveOverlay, resizeOverlay, getStoredPose, getChildren, isContainer } = opts;
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const boxes = boxReader(d, opts.scene);

  const selectionLeaves = (id: string): string[] =>
    getChildren && isContainer ? leavesOf(id, getChildren, isContainer) : [id];

  const resolveLeaf = (id: string): TPose => {
    const moved = moveOverlay?.poses.get(id);
    if (moved !== undefined) return moved;
    if (resizeOverlay && resizeOverlay.id === id) return resizeOverlay.currentPose;
    return getStoredPose(id);
  };

  return (id: string): TPose | null => {
    if (isContainer?.(id)) {
      const leaves = selectionLeaves(id);
      if (leaves.length === 0) return null;
      const containerResizeLeafPoses =
        resizeOverlay && resizeOverlay.id === id ? resizeOverlay.leafPoses : undefined;
      const scale = opts.viewScale?.();
      const leafBounds: Bounds[] = [];
      for (const leafId of leaves) {
        const pose = moveOverlay?.poses.get(leafId)
          ?? containerResizeLeafPoses?.get(leafId)
          ?? getStoredPose(leafId);
        leafBounds.push(boxes.aabb(leafId, pose, scale));
      }
      const u = unionAABB(leafBounds);
      if (u === null) return null;
      return d.fromBounds(u, getStoredPose(leaves[0]!));
    }
    return resolveLeaf(id);
  };
}

/**
 * Build a bounds resolver that handles container ids by computing the union
 * AABB of every leaf's bounds. Non-container ids pass through directly. When
 * `getChildren`/`isContainer` are omitted, every id is treated as a leaf.
 * With a scene, each leaf is boxed as drawn at the view's scale.
 */
export function containerAwareBoundsResolver<TPose>(
  getPose: (id: string) => TPose | null,
  d: PoseDescriptor<TPose>,
  getChildren: ((id: string) => readonly string[]) | undefined,
  isContainer: ((id: string) => boolean) | undefined,
  scene: DrawnBoundsScene | undefined,
): (id: string, scale: Scale2) => Bounds | null {
  const boxes = boxReader(d, scene);
  const leaf = (id: string, scale: Scale2): Bounds | null => {
    const p = getPose(id);
    return p === null ? null : boxes.framed(id, p, scale);
  };
  if (getChildren === undefined || isContainer === undefined) return leaf;
  return (id, scale) => {
    if (!isContainer(id)) return leaf(id, scale);
    const leaves = leavesOf(id, getChildren, isContainer);
    if (leaves.length === 0) return null;
    const leafBounds: Bounds[] = [];
    for (const leafId of leaves) {
      const p = getPose(leafId);
      if (p !== null) leafBounds.push(boxes.aabb(leafId, p, scale));
    }
    if (leafBounds.length === 0) return null;
    return unionAABB(leafBounds);
  };
}
