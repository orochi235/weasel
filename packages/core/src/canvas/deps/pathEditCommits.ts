/**
 * What the `editAnchors` dep commits: an edit finished by every path-edit
 * extension, the other nodes the extensions change with it, and the same for
 * a whole-node transform's batch.
 */
import type { PointOrigin, PolygonPath } from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { createSetDataOp } from 'core/ops/setData';
import { createDeleteOp } from 'core/ops/delete';
import { writtenBy } from 'core/ops/writtenBy';
import type { TransformFollower, TransformPreviewNode } from 'interactions/actions/transformFinish';
import type { NodeId, Scene } from 'core/scene/types';
import { pathEditPathOf, storeEditablePath } from 'features/paths/editablePath';
import { withoutShapeGenerator } from 'features/paths/shapeGenerator';
import {
  withoutGeometryBoundData, type PathEditExtension, type PathEditFinishCtx, type PathEditOther, type PathTransformFinishCtx,
} from 'features/paths/pathEditExtension';

type AnyScene = Scene<unknown, string, unknown>;
export type EditableNode = { pose: unknown; data: unknown };

/** What {@link finishEdit} answers: the edited path, the data set beside it, and the other nodes it changes, by id. */
export interface Finished {
  path: PolygonPath;
  data: Record<string, unknown> | null;
  others: Map<string, PathEditOther>;
}

/** The nodes that list `id` in their `dependsOn`, directly or through others. */
function dependentsOf(sc: AnyScene, id: string): readonly string[] {
  if (!sc.get(id as NodeId)) return [];
  return sc.removalClosure([id as NodeId]).filter((d) => d !== id && !sc.ancestorsOf(d).includes(id as NodeId));
}

/** The scene as an extension's `finishEdit` reads it. */
export function finishCtx(sc: AnyScene, id: string, extensions: readonly PathEditExtension[]): PathEditFinishCtx {
  return {
    id,
    node(nid) {
      const node = sc.get(nid as NodeId);
      return node ? { pose: node.pose, data: node.data, dependsOn: node.dependsOn } : null;
    },
    path: (nid) => pathEditPathOf(sc.get(nid as NodeId) as EditableNode | undefined, extensions),
    dependents: (nid) => dependentsOf(sc, nid),
  };
}

/** `o` laid over what `others` already holds for its node. */
function addOther(others: Map<string, PathEditOther>, o: PathEditOther): void {
  const had = others.get(o.id);
  others.set(o.id, {
    id: o.id,
    path: o.path ?? had?.path,
    data: o.data || had?.data ? { ...had?.data, ...o.data } : undefined,
    remove: o.remove || had?.remove,
  });
}

/** `worldPath` finished by each of `extensions` in turn, the data they set
 *  beside it, and the other nodes they change; null when one cannot finish it. */
export function finishEdit(
  extensions: readonly PathEditExtension[],
  node: EditableNode,
  worldPath: PolygonPath,
  origins: readonly (PointOrigin | null)[] | undefined,
  ctx: PathEditFinishCtx,
): Finished | null {
  let path = worldPath;
  let data: Record<string, unknown> | null = null;
  const others = new Map<string, PathEditOther>();
  for (const ext of extensions) {
    if (!ext.finishEdit) continue;
    const done = ext.finishEdit(node, path, origins, ctx);
    if (!done) return null;
    path = done.path;
    if (done.data) data = { ...(data ?? {}), ...done.data };
    for (const o of done.others ?? []) addOther(others, o);
  }
  return { path, data, others };
}

/** The ops that commit `others`, each from its node as committed. */
export function otherOps(
  sc: AnyScene,
  others: ReadonlyMap<string, PathEditOther>,
  label: string,
  extensions: readonly PathEditExtension[],
): Op[] {
  return [...others.values()].flatMap((o) => {
    const node = sc.get(o.id as NodeId) as EditableNode | undefined;
    if (!node) return [];
    if (o.remove) return [createDeleteOp({ node: sc.get(o.id as NodeId)!, label })];
    if (o.path) return reshapeOps(o.id, node, o.path, label, o.data ?? null, extensions);
    return o.data ? [createSetDataOp({ id: o.id, from: node.data, to: { ...(node.data as object), ...o.data }, label })] : [];
  });
}

/** The ops that store `worldPath` where `node` keeps its polygon, with `patch` laid over its data. */
export function reshapeOps(
  id: string,
  node: EditableNode,
  worldPath: PolygonPath,
  label: string,
  patch: Record<string, unknown> | null,
  extensions: readonly PathEditExtension[],
): Op[] {
  const next = storeEditablePath(node, worldPath, extensions);
  if (!next) return [];
  const reshape = createTransformOp({ id, from: node.pose, to: next.pose, label });
  // A path edited by hand is no longer what its generator or warp makes: it becomes plain geometry.
  // Its skin and constraints stay, renumbered by the caller's patch where it has one, and the
  // form it was drawn from as storing it left it.
  const data = withoutGeometryBoundData(
    next.data === node.data ? node.data : withoutShapeGenerator(next.data), ['skin', 'constraints', 'representation'],
  );
  if (data === node.data && !patch) return [reshape];
  return [reshape, createSetDataOp({ id, from: node.data, to: { ...(data as object), ...patch }, label })];
}

/** The other nodes `extensions` change along with a transform that leaves the nodes in `after` as given; null when one refuses it. */
function transformOthers(
  sc: AnyScene,
  extensions: readonly PathEditExtension[],
  after: ReadonlyMap<string, EditableNode>,
): Map<string, PathEditOther> | null {
  const others = new Map<string, PathEditOther>();
  const finishing = extensions.filter((e) => e.finishTransform);
  if (finishing.length === 0 || after.size === 0) return others;
  const nodeAfter = (id: string) => {
    const node = sc.get(id as NodeId);
    if (!node) return null;
    const written = after.get(id);
    return { pose: written?.pose ?? node.pose, data: written?.data ?? node.data, dependsOn: node.dependsOn };
  };
  const ctx: PathTransformFinishCtx = {
    ids: [...after.keys()],
    node: nodeAfter,
    path: (id) => pathEditPathOf(nodeAfter(id) ?? undefined, extensions),
    before: (id) => pathEditPathOf(sc.get(id as NodeId) as EditableNode | undefined, extensions),
    dependents: (id) => dependentsOf(sc, id),
  };
  for (const ext of finishing) {
    const done = ext.finishTransform!(ctx);
    if (!done) return null;
    for (const o of done) if (!after.has(o.id)) addOther(others, o);
  }
  return others;
}

/** `ops`, a whole-node transform's batch, with the ops `extensions` add for the other nodes it changes; null when one refuses it. */
export function transformOps(
  sc: AnyScene,
  extensions: readonly PathEditExtension[],
  ops: readonly Op[],
  label: string,
): Op[] | null {
  const after = extensions.some((e) => e.finishTransform) ? writtenBy(sc, ops) : null;
  if (!after || after.size === 0) return [...ops];
  const others = transformOthers(sc, extensions, after);
  return others && [...ops, ...otherOps(sc, others, label, extensions)];
}

/**
 * The other nodes `extensions` change along with a transform frame that
 * poses the nodes in `poses` as given, each as it would be stored — what
 * {@link transformOps} would commit for that frame, read the same way. Empty
 * when nothing changes with it, or an extension refuses it.
 */
export function transformPreview(
  sc: AnyScene,
  extensions: readonly PathEditExtension[],
  poses: ReadonlyMap<string, unknown>,
): TransformPreviewNode[] {
  if (poses.size === 0 || !extensions.some((e) => e.finishTransform)) return [];
  const after = new Map<string, EditableNode>();
  for (const [id, pose] of poses) {
    const node = sc.get(id as NodeId);
    if (node) after.set(id, { pose, data: node.data });
  }
  const others = transformOthers(sc, extensions, after);
  return [...(others?.values() ?? [])].flatMap((o) => {
    const node = sc.get(o.id as NodeId) as EditableNode | undefined;
    const stored = node && o.path && !o.remove ? storeEditablePath(node, o.path, extensions) : null;
    if (!node || !stored) return [];
    return [stored.data === node.data ? { id: o.id, pose: stored.pose } : { id: o.id, pose: stored.pose, data: stored.data }];
  });
}

/** The transform follower `extensions` make: each one's `finishTransform`, as
 *  {@link transformOps} and {@link transformPreview} read it. Null when none
 *  has one, so a transform runs no follower for them. */
export function pathEditFollower(sc: AnyScene, extensions: readonly PathEditExtension[]): TransformFollower | null {
  if (!extensions.some((e) => e.finishTransform)) return null;
  return {
    finish: (ops, label) => transformOps(sc, extensions, ops, label),
    preview: (poses) => transformPreview(sc, extensions, poses),
  };
}
