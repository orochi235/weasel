/**
 * The scene adapter's clipboard seam: what a copy captures and what a paste
 * mints from it.
 *
 * `pasteSceneSnapshot` is a pure factory — it mints fresh nodes and never
 * touches the scene. Insertion happens through the caller's InsertOps (one per
 * created node, parents before children).
 *
 * A snapshot item carries its node's function fields twice: live, for a paste
 * in the same session, and as the scene's registry keys, for a snapshot that
 * crossed JSON on the way back.
 */
import { holderOf, outermost } from '@weasel-js/select';
import type { ClipboardSnapshot, PasteCtx, PasteOmission } from 'core/adapters/types';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { hasChildren } from 'core/scene/treeShape';
import { sourcesOf } from 'core/scene/dependents';
import { definesFrame } from 'core/scene/effectivePose';
import {
  NODE_FN_FIELDS, createNodeFnFields, fnFieldsOfNode, fnKeysOf, type FnBearingNode,
} from 'core/scene/nodeFnFields';
import { statedFields } from 'core/scene/statedFields';
import type { Bounds } from '../core/viewport/fitViewToBounds';
import type { InsertSite } from './deps/insertSite';

/** What the seam needs from the adapter it serves. */
export interface SceneClipboardEnv<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  worldPoseOf(id: string): TPose;
  /** The nearest frame-defining container at or above `id`. */
  frameAtOrAbove(id: string | null): string | null;
  poseBounds(pose: TPose, node: unknown): Bounds;
  translate(pose: TPose, dx: number, dy: number, node?: unknown): TPose;
  /** Where the pasted cluster's roots land; absent, or naming no parent, they keep their layer at the top of the tree. */
  landing?: () => InsertSite;
}

// Spread-level copy per the clipboard contract: mutating a snapshot's
// pose/data/children must not touch the scene.
function copyField<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (value !== null && typeof value === 'object') return { ...(value as object) } as T;
  return value;
}

type Item<TData, TLayer extends string, TPose> =
  Node<TData, TLayer, TPose> & Record<string, unknown>;

export function snapshotSceneSelection<TData, TLayer extends string, TPose>(
  env: SceneClipboardEnv<TData, TLayer, TPose>,
  ids: string[],
): ClipboardSnapshot {
  const { scene } = env;
  const fnFields = createNodeFnFields<TPose>(scene.registry as never);
  const idSet = new Set(ids);
  const taken = new Set<string>();
  const items: Node<TData, TLayer, TPose>[] = [];
  // A stored pose is relative to its frame, and a node whose frame is not
  // copied with it lands somewhere else entirely on paste. Capture those in
  // world coordinates: every root, and under an envelope root, the nodes
  // sharing the frame the root left behind.
  const poseFor = (n: Node<TData, TLayer, TPose>, isRoot: boolean): TPose => {
    if (isRoot) return env.worldPoseOf(n.id);
    const frame = env.frameAtOrAbove(n.parent);
    return frame !== null && taken.has(frame) ? n.pose : env.worldPoseOf(n.id);
  };

  // DFS from one snapshot root: push the node, then its subtree —
  // parents-before-children, so paste can re-insert in array order.
  const capture = (id: string, isRoot = false): void => {
    if (taken.has(id)) return;
    const n = scene.get(asNodeId(id));
    if (!n) return;
    taken.add(id);
    items.push({
      kind: n.kind,
      id: n.id,
      layer: n.layer,
      parent: n.parent,
      pose: copyField(poseFor(n, isRoot)),
      data: copyField(n.data),
      ...(n.children !== undefined ? { children: [...n.children] } : {}),
      ...statedFields(n),
      ...(n.dependsOn !== undefined ? { dependsOn: copyField(n.dependsOn) } : {}),
      ...fnFieldsOfNode(n),
      ...fnKeysOf(fnFields, n as unknown as FnBearingNode, 'jsonKey'),
    } as Node<TData, TLayer, TPose>);
    if (hasChildren(n)) {
      for (const cid of scene.childrenOf(asNodeId(id))) capture(cid);
    }
  };
  const parentOf = (id: string) => scene.get(asNodeId(id))?.parent;
  const covered = (id: string): boolean => holderOf(idSet, id, parentOf) !== null;
  // A hidden node cannot be selected, so one that a copied node derives from
  // comes with it, ahead of it: without it the paste would leave the copy out.
  const carrying = new Set<string>();
  const carrySources = (id: string): void => {
    if (carrying.has(id)) return;
    carrying.add(id);
    const n = scene.get(asNodeId(id));
    if (!n) return;
    for (const source of sourcesOf(n)) {
      if (taken.has(source) || covered(source) || scene.get(source)?.hidden !== true) continue;
      carrySources(source);
      capture(source, true);
    }
    if (hasChildren(n)) for (const cid of scene.childrenOf(asNodeId(id))) carrySources(cid);
  };
  // An id an ancestor holds comes with that ancestor's subtree walk.
  for (const id of outermost(ids, parentOf)) {
    carrySources(id);
    capture(id, true);
  }
  return { items };
}

// JSON drops a function, and turns a layout strategy into an object with no
// methods on it: neither is something a pasted node can run.
const isLive = (value: unknown): boolean =>
  typeof value === 'function'
  || (typeof value === 'object' && value !== null
    && Object.values(value).some((member) => typeof member === 'function'));

/**
 * The item's function fields: for each, what its registry key names in this
 * scene, else the live one it carries, else nothing.
 */
function restoredFnFields<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  item: Item<TData, TLayer, TPose>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const registry = scene.registry as Record<string, Record<string, unknown> | undefined>;
  for (const spec of NODE_FN_FIELDS) {
    const key = item[spec.jsonKey];
    const registered = typeof key === 'string' ? registry[spec.field]?.[key] : undefined;
    const fn = registered ?? (isLive(item[spec.field]) ? item[spec.field] : undefined);
    if (fn !== undefined) out[spec.field] = fn;
  }
  return out;
}

/**
 * Which items a paste leaves out, and why. A node deriving from an id list is
 * pasted only with everything it depends on, since a copy still naming the
 * originals would follow them rather than the copies beside it; and only with
 * a derivation to run, since without one it is a placeholder that paints
 * nothing. Leaving one out can strand another, so this runs to a fixed point.
 */
function omissions<TData, TLayer extends string, TPose>(
  src: readonly Item<TData, TLayer, TPose>[],
  fns: ReadonlyMap<string, Record<string, unknown>>,
): Map<string, PasteOmission> {
  const out = new Map<string, PasteOmission>();
  const present = new Set(src.map((item) => item.id as string));
  for (let changed = true; changed;) {
    changed = false;
    for (const item of src) {
      if (out.has(item.id)) continue;
      let omission: PasteOmission | undefined;
      const deps = sourcesOf(item);
      const missing = deps.filter((dep) => !present.has(dep));
      const fn = fns.get(item.id)!;
      if (item.parent !== null && out.has(item.parent)) {
        omission = { id: item.id, reason: 'container-not-pasted' };
      } else if (missing.length > 0) {
        omission = { id: item.id, reason: 'dependency-not-copied', missing };
      } else if (deps.length > 0 && fn.derivePath === undefined && fn.derivePose === undefined) {
        omission = { id: item.id, reason: 'derivation-not-registered' };
      }
      if (omission === undefined) continue;
      out.set(item.id, omission);
      present.delete(item.id);
      changed = true;
    }
  }
  return out;
}

export function pasteSceneSnapshot<TData, TLayer extends string, TPose>(
  env: SceneClipboardEnv<TData, TLayer, TPose>,
  clipboard: ClipboardSnapshot,
  offset: { dx: number; dy: number },
  ctx?: PasteCtx,
): Node<TData, TLayer, TPose>[] {
  const all = clipboard.items as Item<TData, TLayer, TPose>[];
  if (all.length === 0) return [];
  const fns = new Map(all.map((item) => [item.id as string, restoredFnFields(env.scene, item)]));
  const omitted = omissions(all, fns);
  if (ctx?.onOmit) for (const item of all) {
    const omission = omitted.get(item.id);
    if (omission) ctx.onOmit(omission);
  }
  const src = omitted.size === 0 ? all : all.filter((item) => !omitted.has(item.id));

  const idMap = new Map<string, NodeId>();
  for (const item of src) idMap.set(item.id, env.scene.mintId());
  // Items whose captured parent isn't part of the snapshot become roots
  // of the pasted cluster.
  const isRoot = (item: Node<TData, TLayer, TPose>): boolean =>
    item.parent === null || !idMap.has(item.parent);
  // A node inside a pasted frame rides it, and offsetting it as well would
  // move it twice.
  const byId = new Map(src.map((item) => [item.id as string, item]));
  const ridesPastedFrame = (item: Node<TData, TLayer, TPose>): boolean => {
    let p = item.parent === null ? undefined : byId.get(item.parent);
    while (p !== undefined) {
      if (definesFrame(p)) return true;
      p = p.parent === null ? undefined : byId.get(p.parent);
    }
    return false;
  };
  let dx = offset.dx;
  let dy = offset.dy;
  if (ctx?.dropPoint) {
    // Drop-point policy: land the cluster origin (min corner of the root
    // items' bounds) on the drop point; `offset` is ignored.
    let minX = Infinity;
    let minY = Infinity;
    for (const item of src) {
      if (!isRoot(item)) continue;
      const b = env.poseBounds(item.pose, item);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
    }
    if (Number.isFinite(minX) && Number.isFinite(minY)) {
      dx = ctx.dropPoint.x - minX;
      dy = ctx.dropPoint.y - minY;
    }
  }
  const site = env.landing?.();
  const into = site?.parent != null ? site : null;
  const placed = (item: Item<TData, TLayer, TPose>): TPose => {
    if (ridesPastedFrame(item)) return copyField(item.pose);
    const moved = env.translate(copyField(item.pose), dx, dy, item);
    return into && isRoot(item) ? into.local(moved) as TPose : moved;
  };
  // `src` is parents-before-children and this keeps it, so children re-attach
  // to freshly inserted parents when the caller's InsertOps apply in order.
  return src.map((item) => ({
    id: idMap.get(item.id)!,
    kind: item.kind,
    layer: into && isRoot(item) ? into.layer as TLayer : item.layer,
    parent: isRoot(item) ? into?.parent ?? null : idMap.get(item.parent as string)!,
    pose: placed(item),
    data: copyField(item.data),
    ...statedFields(item),
    ...(item.children !== undefined
      ? { children: item.children.filter((c) => idMap.has(c)).map((c) => idMap.get(c)!) }
      : {}),
    ...(item.dependsOn === 'children'
      ? { dependsOn: 'children' as const }
      : sourcesOf(item).length > 0
        ? { dependsOn: sourcesOf(item).map((dep) => idMap.get(dep)!) }
        : {}),
    ...fns.get(item.id),
  } as Node<TData, TLayer, TPose>));
}
