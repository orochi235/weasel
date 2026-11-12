import { sameValue as same } from './sameValue';
import type { AddNodeSpec, NodeId, Scene } from './types';

/**
 * Bring `scene` from `prev` to `next`: add what `next` gained, remove what it
 * lost, and write only the fields that changed between the two.
 *
 * The diff is spec against spec, not spec against scene, so whatever the scene
 * did since `prev` — a node dragged, an edge authored by a gesture — survives
 * unless `next` changes that same field. The writes are untracked: syncing to
 * outside data is not an undo step.
 *
 * Every spec needs an `id`, and `next` must be in an order `createScene` would
 * accept — parents and dependencies before what names them. Siblings stand in
 * `next`'s order wherever a parent's children in it differ from `prev`'s, by an
 * addition or a reorder; elsewhere a reorder made in the scene stays. A node whose
 * `kind` or derive functions change is removed and added again, along with
 * everything its removal takes with it, and stays selected and scrolled if it was.
 */
export function reconcileSpecs<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  prev: readonly AddNodeSpec<TData, TLayer, TPose>[],
  next: readonly AddNodeSpec<TData, TLayer, TPose>[],
): void {
  const prevById = byId(prev);
  const nextById = byId(next);
  const gone: NodeId[] = [];
  for (const [id, before] of prevById) {
    const after = nextById.get(id);
    if (after === undefined || needsReplace(before, after)) gone.push(id);
  }
  const removing = scene.removalClosure(gone.filter((id) => scene.get(id) !== undefined));
  const removed = new Set(removing);

  // A replaced node is the same node to whoever selected it or scrolled it.
  const selected = scene.getSelection();
  const scrolled = removing.flatMap((id) => {
    const offset = scene.scroll.get(id);
    return offset === undefined ? [] : [[id, offset] as const];
  });
  // `setLayer` carries a node's subtree with it, so a member whose own layer did not change is put back after.
  const startLayer = new Map<NodeId, TLayer>();
  for (const spec of next) {
    const node = scene.get(spec.id!);
    if (node !== undefined) startLayer.set(spec.id!, node.layer);
  }

  // Syncing to outside data reaches a node a lock guards, as a replay does.
  scene.untracked(() => scene.unlocked(() => {
    scene.removeMany(removing);
    for (const spec of next) {
      const id = spec.id!;
      const before = prevById.get(id);
      if (scene.get(id) === undefined || before === undefined || removed.has(id)) {
        scene.add(spec);
        continue;
      }
      const parent = spec.parent ?? null;
      const moves = parent !== (before.parent ?? null);
      const relayers = spec.layer !== before.layer;
      // A child may not sit below its parent's layer, so the layer goes first unless the old parent forbids it.
      const layerFirst = relayers && moves && allowedUnder(scene, scene.get(id)!.parent, spec.layer);
      if (layerFirst) scene.setLayer(id, spec.layer);
      if (moves) scene.move(id, parent);
      if (relayers && !layerFirst) scene.setLayer(id, spec.layer);
      else if (!relayers) restoreLayer(scene, id, startLayer.get(id));
      if (!same(spec.data, before.data)) scene.update(id, { data: spec.data });
      if (!same(spec.dependsOn, before.dependsOn)) scene.setDependsOn(id, spec.dependsOn);
      if (!same(spec.units, before.units)) scene.setUnits(id, spec.units ?? null);
      if (spec.clip !== before.clip) scene.setClip(id, spec.clip ?? null);
      if (!same(spec.page, before.page)) scene.setPage(id, spec.page ?? null);
      if (!same(spec.pageRun, before.pageRun)) scene.setPageRun(id, spec.pageRun ?? null);
      if (!same(spec.pose, before.pose)) scene.setPose(id, spec.pose);
      if ((spec.hidden === true) !== (before.hidden === true)) scene.setHidden(id, spec.hidden === true);
      if ((spec.locked === true) !== (before.locked === true)) scene.setLocked(id, spec.locked === true);
    }
    reorderToSpecs(scene, prev, next);
    for (const [id, offset] of scrolled) if (scene.get(id) !== undefined) scene.scroll.set(id, offset);
    if (selected.some((id) => removed.has(id))) {
      scene.setSelection(selected.filter((id) => scene.get(id) !== undefined));
    }
  }));
}

/** Put `id` back on `layer` where its parent's layer, which may have just moved, still lets it stand there. */
function restoreLayer<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: NodeId,
  layer: TLayer | undefined,
): void {
  const node = scene.get(id)!;
  if (layer === undefined || node.layer === layer) return;
  if (allowedUnder(scene, node.parent, layer)) scene.setLayer(id, layer);
}

/** Whether a child of `parent` may stand on `layer`: not below the parent's own. */
function allowedUnder<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  parent: NodeId | null,
  layer: TLayer,
): boolean {
  const p = parent === null ? undefined : scene.get(parent);
  if (p === undefined) return true;
  const rank = (l: TLayer) => scene.layers.findIndex((r) => r.id === l);
  return rank(layer) >= rank(p.layer);
}

/** Each parent whose spec children `next` lists differently from `prev` gets
 *  them in `next`'s order, in the slots they hold among its children now, so
 *  a child no spec names keeps its place. */
function reorderToSpecs<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  prev: readonly AddNodeSpec<TData, TLayer, TPose>[],
  next: readonly AddNodeSpec<TData, TLayer, TPose>[],
): void {
  const before = childLists(prev);
  for (const [parent, wanted] of childLists(next)) {
    if (same(wanted, before.get(parent))) continue;
    const named = new Set(wanted);
    const siblings = parent === null ? scene.roots : scene.childrenOf(parent);
    const slots = siblings.flatMap((id, i) => (named.has(id) ? [i] : []));
    const order = wanted.filter((id) => siblings.includes(id));
    // Filling the slots left to right, each move leaves every earlier slot as it should end.
    order.forEach((id, k) => scene.reorder(id, slots[k]!));
  }
}

function childLists<T extends { id?: NodeId; parent?: NodeId | null }>(specs: readonly T[]): Map<NodeId | null, NodeId[]> {
  const out = new Map<NodeId | null, NodeId[]>();
  for (const spec of specs) {
    const parent = spec.parent ?? null;
    out.set(parent, [...(out.get(parent) ?? []), spec.id!]);
  }
  return out;
}

function byId<T extends { id?: NodeId }>(specs: readonly T[]): Map<NodeId, T> {
  const out = new Map<NodeId, T>();
  for (const spec of specs) {
    if (spec.id === undefined) throw new Error('reconcileSpecs: every spec needs an id');
    if (out.has(spec.id)) throw new Error(`reconcileSpecs: id "${spec.id}" appears more than once`);
    out.set(spec.id, spec);
  }
  return out;
}

function needsReplace<TData, TLayer extends string, TPose>(
  a: AddNodeSpec<TData, TLayer, TPose>,
  b: AddNodeSpec<TData, TLayer, TPose>,
): boolean {
  return a.kind !== b.kind
    || a.pickable !== b.pickable
    || a.consumesChildren !== b.consumesChildren
    || a.derivePath !== b.derivePath
    || a.derivePose !== b.derivePose
    || a.clipFromPose !== b.clipFromPose
    || a.copiesFromPose !== b.copiesFromPose
    || a.layout !== b.layout;
}
