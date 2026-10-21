import type { ActionDeps } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { commitOps } from './defaultCommitAdapter';

/** Finishes a whole-node transform's batch: the batch with the ops for the
 *  other nodes that change with it, or null when the transform should not
 *  happen. */
export type TransformFinisher = (ops: Op[], label: string) => Op[] | null;

/** A node as a transform frame previews it: its stored pose, and its data where that changes. */
export interface TransformPreviewNode {
  id: string;
  pose: unknown;
  data?: unknown;
}

/**
 * Something that changes other nodes along with a whole-node transform — a
 * move, resize, rotate, flip, align, distribute, or nudge. The
 * `transformFollowers` dep holds every one, and each transform runs them all,
 * in order.
 */
export interface TransformFollower {
  /** The other nodes a drag's frame changes, given the stored pose the frame
   *  puts each transformed node in: what `finish` would commit for it.
   *  `data` holds the data the followers before this one previewed, by id. */
  preview(frame: ReadonlyMap<string, unknown>, data: ReadonlyMap<string, unknown>): readonly TransformPreviewNode[];
  /** `ops`, the batch so far, with this follower's ops added after it; null
   *  when it refuses the transform. */
  finish(ops: readonly Op[], label: string): Op[] | null;
}

/** Every follower in `deps.transformFollowers` finishing the batch in turn, as a {@link TransformFinisher}; undefined with none. */
export function transformFinisher(deps: ActionDeps | undefined): TransformFinisher | undefined {
  const followers = deps?.transformFollowers;
  if (followers === undefined || followers.length === 0) return undefined;
  return (ops, label) => {
    let all: Op[] = ops;
    for (const follower of followers) {
      const next = follower.finish(all, label);
      if (next === null) return null;
      all = next;
    }
    return all;
  };
}

/** `ops` finished as a whole-node transform's batch under `deps`; null when the transform should not happen. */
export function finishTransformOps(deps: ActionDeps | undefined, ops: Op[], label: string): Op[] | null {
  const finish = transformFinisher(deps);
  return finish && ops.length > 0 ? finish(ops, label) : ops;
}

/** Commit `ops`, a whole-node transform's batch, finished under `deps`, as
 *  one undo entry. Returns whether anything was committed. */
export function commitTransformOps(deps: ActionDeps, ops: Op[], label: string): boolean {
  const all = finishTransformOps(deps, ops, label);
  if (!all || all.length === 0) return false;
  commitOps(deps, all, label);
  return true;
}

/** What a whole-node transform commits its batch through: `deps.applyOps`
 *  when nothing finishes transforms, else a commit that finishes it first. */
export function transformApplyOps(deps: ActionDeps): ((ops: Op[], label: string) => void) | undefined {
  if (!transformFinisher(deps)) return deps.applyOps;
  return (ops, label) => { commitTransformOps(deps, ops, label); };
}

/** Every follower's preview of `frame`, each reading the frame with the poses and data the ones before it previewed. */
function previewFollowers(followers: readonly TransformFollower[], frame: ReadonlyMap<string, unknown>): TransformPreviewNode[] {
  const out = new Map<string, TransformPreviewNode>();
  let seen = frame;
  const data = new Map<string, unknown>();
  for (const follower of followers) {
    const more = follower.preview(seen, data);
    if (more.length === 0) continue;
    const next = new Map(seen);
    for (const node of more) {
      const had = out.get(node.id);
      out.set(node.id, node.data === undefined && had?.data !== undefined ? { ...node, data: had.data } : node);
      if (node.data !== undefined) data.set(node.id, node.data);
      next.set(node.id, node.pose);
    }
    seen = next;
  }
  return [...out.values()];
}

/** The preview half of a whole-node transform drag: its own previews, and
 *  the other nodes each frame changes with them. */
export interface TransformPreview {
  /** What the drag publishes to the scene's pose overrides: the frame's own
   *  poses, and each follower's pose that is not the node's own. A follower
   *  answering a node's own pose pins nothing, so a derived node keeps
   *  deriving. */
  poses(): ReadonlyMap<NodeId, unknown>;
  /** The handle's `previewIds`: the frame's ids, then the followers'. */
  previewIds(): Iterable<string>;
  /** The handle's `previewData`: what the followers preview for `id`. */
  previewData(id: string): unknown | null;
}

/**
 * A transform drag's preview over `previews`, its frame's stored poses by id,
 * with the nodes `deps.transformFollowers` say change with each frame added:
 * they follow the drag as the commit will leave them. Pose goes to the
 * scene's overrides through {@link TransformPreview.poses}, never on the
 * handle; readers resolve it with `effectivePose`. Each frame is read once,
 * keyed on the map.
 */
export function transformPreview(
  deps: ActionDeps | undefined,
  scene: { get(id: NodeId): { pose: unknown } | undefined },
  previews: () => ReadonlyMap<NodeId, unknown>,
): TransformPreview {
  const followers = deps?.transformFollowers ?? [];
  let seen: ReadonlyMap<NodeId, unknown> | null = null;
  let others = new Map<string, TransformPreviewNode>();
  let posed: ReadonlyMap<NodeId, unknown> = new Map();
  const read = () => {
    const now = previews();
    if (now !== seen) {
      seen = now;
      others = followers.length === 0 || now.size === 0
        ? new Map()
        : new Map(previewFollowers(followers, now as ReadonlyMap<string, unknown>).map((o) => [o.id, o]));
      let moved: Map<NodeId, unknown> | null = null;
      for (const [id, node] of others) {
        const nid = id as NodeId;
        if (now.has(nid) || node.pose === scene.get(nid)?.pose) continue;
        moved ??= new Map(now);
        moved.set(nid, node.pose);
      }
      posed = moved ?? now;
    }
    return others;
  };
  return {
    poses: () => {
      read();
      return posed;
    },
    previewIds: () => {
      const more = read();
      const own = previews();
      // The close empties the frame in place, so the memo still holds its followers.
      return more.size === 0 || own.size === 0 ? own.keys() : [...own.keys(), ...[...more.keys()].filter((id) => !own.has(id as NodeId))];
    },
    previewData: (id) => read().get(id)?.data ?? null,
  };
}
