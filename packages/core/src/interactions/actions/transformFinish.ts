import type { ActionDeps } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import { commitOps } from './defaultCommitAdapter';

/** Finishes a whole-node transform's batch: the batch with the ops for the
 *  other nodes that change with it, or null when the transform should not
 *  happen. */
export type TransformFinisher = (ops: Op[], label: string) => Op[] | null;

/** The `editAnchors` dep's `transformOps`, as a {@link TransformFinisher}; undefined without one. */
export function transformFinisher(deps: ActionDeps | undefined): TransformFinisher | undefined {
  const dep = deps?.editAnchors;
  return dep?.transformOps ? (ops, label) => dep.transformOps!(ops, label) : undefined;
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

/** The preview half of a whole-node transform drag: its own previews, and the other nodes each frame changes with them. */
export interface TransformPreviewFields {
  previewIds(): Iterable<string>;
  previewPose(id: string): unknown | null;
  previewData(id: string): unknown | null;
}

/**
 * A transform drag's preview fields over `previews`, its frame's stored poses
 * by id, with the nodes the `editAnchors` dep's `transformPreview` says
 * change with each frame added: the linked nodes follow the drag as the
 * commit will leave them. Each frame is read once, keyed on the map.
 */
export function transformPreviewFields(
  deps: ActionDeps | undefined,
  previews: () => ReadonlyMap<string, unknown>,
): TransformPreviewFields {
  const dep = deps?.editAnchors;
  let seen: ReadonlyMap<string, unknown> | null = null;
  let others = new Map<string, { pose: unknown; data?: unknown }>();
  const linked = () => {
    const now = previews();
    if (now !== seen) {
      seen = now;
      others = new Map((dep?.transformPreview?.(now) ?? []).map((o) => [o.id, o]));
    }
    return others;
  };
  return {
    previewIds: () => {
      const own = previews();
      const more = linked();
      return more.size === 0 ? own.keys() : [...own.keys(), ...more.keys()];
    },
    previewPose: (id) => previews().get(id) ?? linked().get(id)?.pose ?? null,
    previewData: (id) => linked().get(id)?.data ?? null,
  };
}
