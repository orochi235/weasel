/**
 * The one computation behind a scene's container layouts: given the
 * containers one edit changed, the pose writes their layouts ask for.
 *
 * A container that lost children and whose strategy has `depart` rearranges
 * the rest through it (and may shrink). One that gained children and whose
 * strategy has `arrive` then places them through it (and may refuse, or
 * grow). Any other changed container — one that reordered children, was
 * resized, had a child moved, or gained or lost children with neither hook —
 * is put back in its resting arrangement, `childPoses`.
 *
 * `LayoutStrategy` is world-framed, so each pose is composed to world before
 * a strategy sees it and each result is rebased into its node's parent frame
 * after. A child already where the strategy puts it is left out, so a pass
 * that changes nothing writes nothing. A child the pass moves takes its own
 * descendants along (`carriedDescendants`). A container this pass resizes is
 * arranged in turn, so nested layouts settle in the same edit.
 */
import {
  composeWorldPose,
  rebaseLocalPose,
  type PoseAdapter,
  type PoseComposition,
} from './composeFrame';
import type { ContainerBounds, LayoutArrival, LayoutChild, LayoutStrategy } from '../../layout/types';
import { carriedDescendants } from './carryDescendants';
import { definesFrame, documentPose, type PoseSource, type PosedNode } from './effectivePose';
import { asRectPose } from './kitRegistry';
import { samePoseValue } from './poseSnapshot';
import type { LayoutFrame, NodeId } from './types';

/** What the pass reads a scene through. */
export interface LayoutPassSource<TPose> extends PoseSource<TPose> {
  get(id: NodeId): (PosedNode<TPose> & { parent: NodeId | null }) | undefined;
  readonly composition: PoseComposition<TPose>;
}

/** How the pass measures and resizes poses, with every default filled. */
export interface ResolvedLayoutFrame<TPose> {
  bounds(pose: TPose, id: NodeId): ContainerBounds | null;
  remap(pose: TPose, from: ContainerBounds, to: ContainerBounds, id: NodeId): TPose;
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
  departures: ReadonlyMap<NodeId, readonly NodeId[]> = new Map(),
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
  const { compose, decompose } = source.composition;
  const world = (id: NodeId): TPose => composeWorldPose(pa, id, compose);

  const queue: NodeId[] = [...new Set<NodeId>([...arrivals.keys(), ...changed])];
  const passes = new Map<NodeId, number>();
  const write = (id: NodeId, pose: TPose): void => {
    const node = source.get(id)!;
    const before = poseOf(id);
    if (samePoseValue(before, pose)) return;
    out.set(id, pose);
    // A container its own `depart` or `arrive` resized is arranged already.
    if (id !== current && node.kind === 'container' && layoutOf(id) !== null
      && resized(frame, id, before, pose)) queue.push(id);
  };
  let current: NodeId | null = null;

  /** The container and its children as the strategy sees them, in world,
   *  with every write this pass has made so far folded in. */
  const frameOf = (containerId: NodeId) => {
    const pose = world(containerId);
    const bounds = frame.bounds(pose, containerId);
    if (bounds === null) return null;
    const children: LayoutChild<TPose>[] = source.childrenOf(containerId).map((cid) => ({
      id: cid as string,
      pose: world(cid),
    }));
    return { world: pose, container: { id: containerId as string, bounds }, children };
  };
  const apply = (
    containerId: NodeId,
    at: NonNullable<ReturnType<typeof frameOf>>,
    result: LayoutArrival<TPose>,
  ): void => {
    if (result.bounds) {
      const node = source.get(containerId)!;
      const sized = frame.remap(at.world, at.container.bounds, result.bounds, containerId);
      write(containerId, rebaseLocalPose(pa, sized, node.parent, compose, decompose));
    }
    for (const [cid, pose] of result.poses) {
      const id = cid as NodeId;
      if (source.get(id)?.parent !== containerId) continue;
      const before = frame.bounds(world(id), id);
      write(id, rebaseLocalPose(pa, pose, containerId, compose, decompose));
      carry(id, before);
    }
  };
  /** Moves `id`'s descendants by however far its write just moved it from `before`. */
  const carry = (id: NodeId, before: ContainerBounds | null): void => {
    const after = frame.bounds(world(id), id);
    if (before === null || after === null) return;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    if (dx === 0 && dy === 0) return;
    const carried = carriedDescendants(
      { childrenOf: (cid) => source.childrenOf(cid), poses: pa, composition: source.composition },
      id,
      (pose, cid) => {
        const b = frame.bounds(pose, cid);
        return b === null ? null : frame.remap(pose, b, { ...b, x: b.x + dx, y: b.y + dy }, cid);
      },
    );
    for (const [cid, pose] of carried) write(cid, pose);
  };

  while (queue.length > 0) {
    const containerId = queue.shift()!;
    current = containerId;
    const n = (passes.get(containerId) ?? 0) + 1;
    passes.set(containerId, n);
    if (n > MAX_PASSES) continue;
    const layout = layoutOf(containerId);
    if (layout === null || source.get(containerId) === undefined) continue;
    const joined = n === 1 ? arrivals.get(containerId) : undefined;
    const left = n === 1 ? departures.get(containerId) : undefined;
    let arranged = false;
    if (left !== undefined && layout.depart) {
      const at = frameOf(containerId);
      if (at === null) continue;
      const joinedSet = new Set<string>(joined ?? []);
      const staying = at.children.filter((c) => !joinedSet.has(c.id));
      apply(containerId, at, layout.depart(at.container, staying, new Set<string>(left)));
      arranged = true;
    }
    if (joined !== undefined && layout.arrive) {
      const at = frameOf(containerId);
      if (at === null) continue;
      const result = layout.arrive(at.container, at.children, new Set<string>(joined));
      if (result === null) return null;
      apply(containerId, at, result);
    } else if (!arranged || joined !== undefined) {
      const at = frameOf(containerId);
      if (at === null) continue;
      apply(containerId, at, { poses: layout.childPoses(at.container, at.children) });
    }
  }
  return out;
}
