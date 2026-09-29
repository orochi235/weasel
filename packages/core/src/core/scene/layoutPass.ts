/**
 * The one computation behind a scene's container layouts: given the
 * containers one edit changed, the pose writes their layouts ask for.
 *
 * A container that gained children and whose strategy has `arrive` places
 * them through it (and may refuse, or grow). Any other changed container —
 * one that lost or reordered children, was resized, or gained children with
 * no `arrive` — is put back in its resting arrangement, `childPoses`.
 *
 * `LayoutStrategy` is world-framed, so each pose is composed to world before
 * a strategy sees it and each result is rebased into its node's parent frame
 * after. A child already where the strategy puts it is left out, so a pass
 * that changes nothing writes nothing. A container this pass resizes is
 * arranged in turn, so nested layouts settle in the same edit.
 */
import {
  IDENTITY_POSE_COMPOSITION,
  composeWorldPose,
  rebaseLocalPose,
  type PoseAdapter,
  type PoseComposition,
} from './composeFrame';
import type { ContainerBounds, LayoutChild, LayoutStrategy } from '../../layout/types';
import { definesFrame, documentPose, type PoseSource, type PosedNode } from './effectivePose';
import { asRectPose } from './kitRegistry';
import { samePoseValue } from './poseSnapshot';
import type { LayoutFrame, NodeId } from './types';

/** What the pass reads a scene through. */
export interface LayoutPassSource<TPose> extends PoseSource<TPose> {
  get(id: NodeId): (PosedNode<TPose> & { parent: NodeId | null }) | undefined;
}

/** How the pass measures and resizes poses, with every default filled. */
export interface ResolvedLayoutFrame<TPose> {
  bounds(pose: TPose, id: NodeId): ContainerBounds | null;
  remap(pose: TPose, from: ContainerBounds, to: ContainerBounds, id: NodeId): TPose;
  composition: PoseComposition<TPose>;
}

/** The pose writes one edit's layouts ask for, or `null` when a strategy
 *  refused the children that joined it. */
export type LayoutPassResult<TPose> = Map<NodeId, TPose> | null;

export function resolveLayoutFrame<TPose>(frame: LayoutFrame<TPose> | undefined): ResolvedLayoutFrame<TPose> {
  return {
    bounds: frame?.bounds ?? ((pose) => {
      const r = asRectPose(pose);
      return r === null ? null : { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
    remap: frame?.remap ?? ((pose, _from, to) => ({ ...(pose as object), ...to }) as TPose),
    composition: frame?.composition ?? (IDENTITY_POSE_COMPOSITION as PoseComposition<TPose>),
  };
}

/** Whether a node going from `from` to `to` changed size. */
export function resized<TPose>(frame: ResolvedLayoutFrame<TPose>, id: NodeId, from: TPose, to: TPose): boolean {
  const a = frame.bounds(from, id);
  const b = frame.bounds(to, id);
  if (a === null || b === null) return a !== b;
  return a.width !== b.width || a.height !== b.height;
}

/** How many times one pass may arrange a container before giving up on it —
 *  only nested layouts that keep resizing each other get close. */
const MAX_PASSES = 16;

export function runLayoutPass<TPose>(
  source: LayoutPassSource<TPose>,
  layoutOf: (id: NodeId) => LayoutStrategy<TPose> | null,
  arrivals: ReadonlyMap<NodeId, readonly NodeId[]>,
  changed: ReadonlySet<NodeId>,
  frame: ResolvedLayoutFrame<TPose>,
): LayoutPassResult<TPose> {
  // Poses already decided in this pass, so a container resized here is the
  // frame its children are rebased into.
  const out = new Map<NodeId, TPose>();
  const poseOf = (id: NodeId): TPose => out.get(id) ?? documentPose(source, source.get(id)!);
  const pa: PoseAdapter<TPose> = {
    getPose: (id) => poseOf(id as NodeId),
    getParent: (id) => source.get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => {
      const node = source.get(id as NodeId);
      return node === undefined || definesFrame(node);
    },
  };
  const { compose, decompose } = frame.composition;
  const world = (id: NodeId): TPose => composeWorldPose(pa, id, compose);

  const queue: NodeId[] = [...new Set<NodeId>([...arrivals.keys(), ...changed])];
  const passes = new Map<NodeId, number>();
  const write = (id: NodeId, pose: TPose): void => {
    const node = source.get(id)!;
    const before = poseOf(id);
    if (samePoseValue(before, pose)) return;
    out.set(id, pose);
    // A container its own `arrive` grew is arranged already.
    if (id !== current && node.kind === 'container' && layoutOf(id) !== null
      && resized(frame, id, before, pose)) queue.push(id);
  };
  let current: NodeId | null = null;

  while (queue.length > 0) {
    const containerId = queue.shift()!;
    current = containerId;
    const n = (passes.get(containerId) ?? 0) + 1;
    passes.set(containerId, n);
    if (n > MAX_PASSES) continue;
    const layout = layoutOf(containerId);
    if (layout === null || source.get(containerId) === undefined) continue;
    const containerWorld = world(containerId);
    const bounds = frame.bounds(containerWorld, containerId);
    if (bounds === null) continue;
    const container = { id: containerId as string, bounds };
    const children: LayoutChild<TPose>[] = source.childrenOf(containerId).map((cid) => ({
      id: cid as string,
      pose: world(cid),
    }));
    const joined = n === 1 ? arrivals.get(containerId) : undefined;
    let poses: Map<string, TPose>;
    if (joined !== undefined && layout.arrive) {
      const result = layout.arrive(container, children, new Set<string>(joined));
      if (result === null) return null;
      if (result.bounds) {
        const node = source.get(containerId)!;
        const grown = frame.remap(containerWorld, bounds, result.bounds, containerId);
        write(containerId, rebaseLocalPose(pa, grown, node.parent, compose, decompose));
      }
      poses = result.poses;
    } else {
      poses = layout.childPoses(container, children);
    }
    for (const [cid, pose] of poses) {
      const id = cid as NodeId;
      if (source.get(id)?.parent !== containerId) continue;
      write(id, rebaseLocalPose(pa, pose, containerId, compose, decompose));
    }
  }
  return out;
}
