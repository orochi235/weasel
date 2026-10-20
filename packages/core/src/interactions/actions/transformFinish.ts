import type { ActionDeps } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
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

/** The preview half of a whole-node transform drag: its own previews, and the other nodes each frame changes with them. */
export interface TransformPreviewFields {
  previewIds(): Iterable<string>;
  previewPose(id: string): unknown | null;
  previewData(id: string): unknown | null;
}

/**
 * A transform drag's preview fields over `previews`, its frame's stored poses
 * by id, with the nodes `deps.transformFollowers` say change with each frame
 * added: they follow the drag as the commit will leave them. Each frame is
 * read once, keyed on the map.
 */
export function transformPreviewFields(
  deps: ActionDeps | undefined,
  previews: () => ReadonlyMap<string, unknown>,
): TransformPreviewFields {
  const followers = deps?.transformFollowers ?? [];
  let seen: ReadonlyMap<string, unknown> | null = null;
  let others = new Map<string, TransformPreviewNode>();
  const linked = () => {
    const now = previews();
    if (now !== seen) {
      seen = now;
      others = followers.length === 0 ? new Map() : new Map(previewFollowers(followers, now).map((o) => [o.id, o]));
    }
    return others;
  };
  return {
    previewIds: () => {
      const own = previews();
      const more = linked();
      return more.size === 0 ? own.keys() : [...own.keys(), ...[...more.keys()].filter((id) => !own.has(id))];
    },
    previewPose: (id) => previews().get(id) ?? linked().get(id)?.pose ?? null,
    previewData: (id) => linked().get(id)?.data ?? null,
  };
}
