import { isPlainObject } from '../isPlainObject';
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
 * accept — parents and dependencies before what names them. A node whose
 * `kind` or derive functions change is removed and added again, along with
 * everything its removal takes with it.
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

  scene.untracked(() => {
    scene.removeMany(removing);
    for (const spec of next) {
      const id = spec.id!;
      const before = prevById.get(id);
      if (scene.get(id) === undefined || before === undefined || removed.has(id)) {
        scene.add(spec);
        continue;
      }
      const parent = spec.parent ?? null;
      if (parent !== (before.parent ?? null)) scene.move(id, parent);
      if (spec.layer !== before.layer) scene.setLayer(id, spec.layer);
      if (!same(spec.data, before.data)) scene.update(id, { data: spec.data });
      if (!same(spec.dependsOn, before.dependsOn)) scene.setDependsOn(id, spec.dependsOn);
      if (!same(spec.pose, before.pose)) scene.setPose(id, spec.pose);
    }
  });
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
    || a.derivePath !== b.derivePath
    || a.derivePose !== b.derivePose
    || a.clipFromPose !== b.clipFromPose
    || a.layout !== b.layout;
}

/** Structural equality over plain objects and arrays; anything else by identity. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => same(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => k in b && same(a[k], b[k]));
  }
  return false;
}
