/**
 * The scene's node store: the tree links, the reverse index of who derives
 * from whom, and the function fields a node carries beside its data.
 *
 * Everything here reads and writes `state.nodes` and `state.roots` directly;
 * none of it records. The kit ops call it from both of their directions.
 */
import { dwarn } from 'debug/flag';
import { createDependentsIndex } from './dependents';
import { dropPoseKeyedMemoSlots } from './nodeMemo';
import { restoreFn, type FnBearingNode, type NodeFn, type NodeFnField } from './nodeFnFields';
import { SceneMembershipError } from './staleReplay';
import type { AddNodeSpec, Node, NodeId } from './types';

/** What the store keeps of a scene's state. */
export interface NodeStoreState<TData, TLayer extends string, TPose> {
  nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
  roots: NodeId[];
}

export function createNodeStore<TData, TLayer extends string, TPose>(
  state: NodeStoreState<TData, TLayer, TPose>,
  /** Called on every edit to the tree's links. */
  invalidateOrder: () => void,
  fnFields: readonly NodeFnField[],
) {
  /** Maintained from `kit:add` / `kit:remove` — the only two places a node is
   *  created or destroyed, and unlike `add`/`remove` they replay on undo/redo.
   *  Only explicit `dependsOn` id lists are registered here; `'children'` is
   *  the ancestor walk in `invalidateDependents` instead. */
  const dependents = createDependentsIndex();

  /** Nodes carrying `dependsOn: 'children'`. Empty in every scene that has no
   *  container hugging its contents, which is what keeps the ancestor walk off
   *  the hot path. */
  const childDerived = new Set<NodeId>();

  /** Walks `id`'s whole subtree: under a composing pose strategy a container's
   *  move carries every descendant, and whatever derives from one. */
  function invalidateDependents(id: NodeId): void {
    invalidateChildDerivedFrom(state.nodes.get(id)?.parent ?? null);
    if (dependents.isEmpty()) return;
    const subtree: NodeId[] = [id];
    descendants(id, subtree);
    for (const src of subtree) {
      for (const dep of dependents.transitiveDependentsOf(src)) {
        const node = state.nodes.get(dep);
        if (node !== undefined) dropPoseKeyedMemoSlots(node);
      }
    }
  }

  /** A `dependsOn: 'children'` container derives from nodes the reverse index
   *  never sees, so its invalidation runs the other way: up the parent chain
   *  from `start` inclusive, and on to each such ancestor's own dependents.
   *
   *  Callers that removed or reparented a node pass the parent explicitly —
   *  a gone node cannot say who its parent was. */
  function invalidateChildDerivedFrom(start: NodeId | null): void {
    if (childDerived.size === 0) return;
    let cursor = start;
    while (cursor !== null) {
      const node = state.nodes.get(cursor);
      if (node === undefined) return;
      if (childDerived.has(cursor)) {
        dropPoseKeyedMemoSlots(node);
        for (const dep of dependents.transitiveDependentsOf(cursor)) {
          const d = state.nodes.get(dep);
          if (d !== undefined) dropPoseKeyedMemoSlots(d);
        }
      }
      cursor = node.parent;
    }
  }

  /** Track (or forget) a node whose `dependsOn` is `'children'`. Paired with
   *  `dependents.add` / `.remove` at every site a node is created or destroyed. */
  function trackChildDerived(id: NodeId, dependsOn: Node<TData, TLayer, TPose>['dependsOn']): void {
    if (dependsOn === 'children') childDerived.add(id);
    else childDerived.delete(id);
  }

  /** Point `id` at a different set of dependencies, keeping both indices and
   *  every memo that reads them in step. Shared by `kit:setDependsOn`'s two
   *  directions, which differ only in which value they install.
   *
   *  `id`'s own memo is dropped as well as its dependents': its derivation now
   *  reads different sources, and nothing else would clear it. */
  function retarget(id: NodeId, dependsOn: Node<TData, TLayer, TPose>['dependsOn']): void {
    const node = requireNode(id) as { dependsOn?: readonly NodeId[] | 'children' };
    if (dependsOn === undefined) delete node.dependsOn;
    else node.dependsOn = dependsOn;
    dependents.add(id, dependsOn === undefined || dependsOn === 'children' ? [] : dependsOn);
    trackChildDerived(id, dependsOn);
    dropPoseKeyedMemoSlots(requireNode(id));
    invalidateDependents(id);
  }

  function requireNode(id: NodeId): Node<TData, TLayer, TPose> {
    const n = state.nodes.get(id);
    if (!n) throw new SceneMembershipError(`Scene: unknown node id "${id}"`);
    return n;
  }

  function siblingsOf(parent: NodeId | null): NodeId[] {
    if (parent === null) return state.roots;
    const p = requireNode(parent);
    return (p.children ??= []);
  }

  function detach(id: NodeId): { parent: NodeId | null; index: number } {
    const node = requireNode(id);
    const sibs = siblingsOf(node.parent);
    const idx = sibs.indexOf(id);
    if (idx < 0) throw new Error(`Scene: node "${id}" not found in its parent's children`);
    sibs.splice(idx, 1);
    invalidateOrder();
    return { parent: node.parent, index: idx };
  }

  function attach(id: NodeId, parent: NodeId | null, index: number): void {
    const sibs = siblingsOf(parent);
    const i = Math.max(0, Math.min(index, sibs.length));
    sibs.splice(i, 0, id);
    const node = requireNode(id);
    (node as { parent: NodeId | null }).parent = parent;
    invalidateOrder();
  }

  function descendants(id: NodeId, out: NodeId[]): void {
    const n = state.nodes.get(id);
    if (!n?.children) return;
    for (const c of n.children) {
      out.push(c);
      descendants(c, out);
    }
  }

  /** Everything removing `rootIds` takes with it: each root's subtree, then
   *  every node deriving from any of those, then those nodes' subtrees in turn.
   *  A dependent is not a descendant, so the second pass is a separate
   *  reachability walk; `ids` grows as it runs, which is what carries the
   *  cascade transitively and upward through a dependent's own ancestors.
   *
   *  Published as {@link Scene.removalClosure}, which is what the delete op and
   *  `buildDeleteOps` ask instead of rebuilding the walk from `dependsOn` and
   *  `children` — a third cascade relation is then added here alone. */
  function removalClosure(rootIds: readonly NodeId[]): {
    ids: NodeId[];
    removing: Set<NodeId>;
  } {
    const ids: NodeId[] = [];
    const removing = new Set<NodeId>();
    function take(id: NodeId): void {
      if (removing.has(id)) return;
      removing.add(id);
      ids.push(id);
      const sub: NodeId[] = [];
      descendants(id, sub);
      for (const s of sub) {
        if (removing.has(s)) continue;
        removing.add(s);
        ids.push(s);
      }
    }
    for (const root of rootIds) take(root);
    for (let i = 0; i < ids.length; i++) {
      for (const dep of dependents.transitiveDependentsOf(ids[i])) take(dep);
    }
    return { ids, removing };
  }

  /** The functions a live `scene.add` attached, by the `kit:add` payload it
   *  recorded: redo replays that payload without the spec. Keyed on the
   *  payload rather than the node id because an id is reusable, and each
   *  add of it owns its own functions. */
  const addedFns = new WeakMap<object, Map<NodeFnField, NodeFn>>();

  /** Post-patch the registry-keyed function fields onto a node after its
   *  `kit:add` op runs. A function cannot travel through the serializable op
   *  payload, so it is attached to the live node here, and kept against
   *  `payload` for redo when there is one. `dependsOn` is plain data and
   *  rides the payload instead. */
  function patchNodeFunctions(
    spec: AddNodeSpec<TData, TLayer, TPose>,
    id: NodeId,
    payload: object | null,
  ): void {
    const node = state.nodes.get(id) as FnBearingNode | undefined;
    if (node === undefined) return;
    const attached = new Map<NodeFnField, NodeFn>();
    for (const field of fnFields) {
      const fn = (spec as unknown as Record<string, unknown>)[field.spec.field] as NodeFn | undefined;
      if (fn === undefined) continue;
      if (field.spec.groupsOnly && spec.kind !== 'group') continue;
      field.write(node, fn);
      attached.set(field, fn);
    }
    if (payload && attached.size > 0) addedFns.set(payload, attached);
  }

  /** Re-attach those fields to a node restored from a `kit:remove` snapshot.
   *  In-session the clone already carries them; a persisted history does not,
   *  so the registry keys are what is left. */
  function restoreNodeFunctions(
    node: Node<TData, TLayer, TPose>,
    keys: Record<string, string | undefined> | undefined,
  ): void {
    if (!keys) return;
    const target = node as unknown as FnBearingNode;
    for (const field of fnFields) {
      if (field.read(target) !== undefined) continue;
      const key = keys[field.spec.opKey];
      if (key === undefined) continue;
      restoreFn(field, target, key, 'kit:remove', dwarn);
    }
  }

  return {
    dependents, childDerived, invalidateDependents, invalidateChildDerivedFrom, trackChildDerived, retarget,
    requireNode, siblingsOf, detach, attach, descendants, removalClosure, addedFns, patchNodeFunctions,
    restoreNodeFunctions,
  };
}
