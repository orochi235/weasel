/**
 * A laid-out container's resting arrangement, as the pose writes it takes.
 *
 * `LayoutStrategy` is world-framed, so each child is composed to world before
 * the strategy sees it and each result is rebased into the child's own parent
 * frame after. A child already where the strategy puts it is left out, which
 * is what lets a pass that changed nothing record nothing.
 */
import {
  IDENTITY_POSE_COMPOSITION,
  composeWorldPose,
  rebaseLocalPose,
  type PoseAdapter,
  type PoseComposition,
} from './composeFrame';
import type { ContainerBounds, LayoutStrategy } from '../../layout/types';
import { definesFrame, documentPose, type PoseSource, type PosedNode } from './effectivePose';
import { asRectPose } from './kitRegistry';
import { samePoseValue } from './poseSnapshot';
import type { LayoutFrame, LayoutMove, NodeId } from './types';

/** What the pass reads a scene through. */
export interface ArrangeSource<TPose> extends PoseSource<TPose> {
  get(id: NodeId): (PosedNode<TPose> & { parent: NodeId | null }) | undefined;
  layoutOf(id: NodeId): LayoutStrategy<TPose> | null;
}

/** The frame a scene lays out in, with its defaults filled. */
export interface ResolvedLayoutFrame<TPose> {
  bounds(pose: TPose): ContainerBounds | null;
  composition: PoseComposition<TPose>;
}

export function resolveLayoutFrame<TPose>(frame: LayoutFrame<TPose> | undefined): ResolvedLayoutFrame<TPose> {
  return {
    bounds: frame?.bounds ?? ((pose) => {
      const r = asRectPose(pose);
      return r === null ? null : { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
    composition: frame?.composition ?? (IDENTITY_POSE_COMPOSITION as PoseComposition<TPose>),
  };
}

/** Whether a container going from `from` to `to` changed size. */
export function resized<TPose>(frame: ResolvedLayoutFrame<TPose>, from: TPose, to: TPose): boolean {
  const a = frame.bounds(from);
  const b = frame.bounds(to);
  if (a === null || b === null) return a !== b;
  return a.width !== b.width || a.height !== b.height;
}

/** The pose writes that put `containerId`'s children where its layout says. */
export function arrange<TPose>(
  source: ArrangeSource<TPose>,
  containerId: NodeId,
  frame: ResolvedLayoutFrame<TPose>,
): LayoutMove<TPose>[] {
  const layout = source.layoutOf(containerId);
  if (layout === null) return [];
  const adapter: PoseAdapter<TPose> = {
    getPose: (id) => documentPose(source, source.get(id as NodeId)!),
    getParent: (id) => source.get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => {
      const node = source.get(id as NodeId);
      return node === undefined || definesFrame(node);
    },
  };
  const { compose, decompose } = frame.composition;
  const bounds = frame.bounds(composeWorldPose(adapter, containerId, compose));
  if (bounds === null) return [];
  const childIds = source.childrenOf(containerId);
  const children = childIds.map((id) => ({ id: id as string, pose: composeWorldPose(adapter, id, compose) }));
  const moves: LayoutMove<TPose>[] = [];
  for (const [id, world] of layout.childPoses({ id: containerId as string, bounds }, children)) {
    const node = source.get(id as NodeId);
    if (node === undefined || node.parent !== containerId) continue;
    const to = rebaseLocalPose(adapter, world, containerId, compose, decompose);
    if (samePoseValue(node.pose, to)) continue;
    moves.push({ id: node.id, from: node.pose, to });
  }
  return moves;
}
