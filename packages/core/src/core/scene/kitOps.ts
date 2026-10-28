/**
 * The kit's own op kinds: `kit:add`, `kit:remove`, `kit:setPose`, and the
 * rest. They are registered like any other op; the scene's mutation methods
 * build serializable payloads and route through the same log and replay
 * machinery a consumer's ops do.
 */
import type { UnitScope } from '@weasel-js/quantity';
import { dwarn } from 'debug/flag';
import type { LayoutStrategy } from '../../layout/types';
import { registerLayerOps } from './layerOps';
import { restoreFn, type FnBearingNode, type NodeFnField } from './nodeFnFields';
import { statedFields } from './statedFields';
import type { createNodeStore } from './nodeStore';
import type {
  LayerRecord, Node, NodeClip, NodeId, RegisteredOp,
} from './types';

/**
 * Snapshot of every node a removal deletes, so revert restores it exactly.
 *
 * A cascade unlinks several disjoint subtrees, not one, so `detached` names
 * each node the tree has to re-link; everything else in `nodes` has a parent
 * that is also going and rides back in that parent's cloned `children`.
 * Entries are sorted by ascending sibling index — globally rather than
 * per-parent, because only same-parent order constrains re-insertion and
 * entries under different parents never interact.
 */
export interface RemoveSnapshot<TData, TLayer extends string, TPose> {
  nodes: Node<TData, TLayer, TPose>[];
  detached: { id: NodeId; parent: NodeId | null; index: number }[];
  /** Registry keys for the function-valued fields on `nodes`. The functions
   *  themselves do not survive a persisted history, so revert re-resolves
   *  them the way `kit:add` does. */
  fnKeys?: ({ id: NodeId } & Record<string, string | undefined>)[];
}

/** What a `kit:setLayout` op carries: the container, and each side's layout
 *  by registry key when it has one. */
export interface SetLayoutPayload { id: NodeId; fromKey?: string; toKey?: string }

/** What the op table needs from the scene it mutates. */
export interface KitOpsEnv<TData, TLayer extends string, TPose> {
  state: {
    nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
    layers: LayerRecord<TLayer>[];
  };
  register(kind: string, handler: RegisteredOp<unknown>): void;
  store: ReturnType<typeof createNodeStore<TData, TLayer, TPose>>;
  requireLayerIndex(layer: TLayer): number;
  rebuildLayerIndex(): void;
  invalidateOrder(): void;
  fnFields: readonly NodeFnField[];
  /** Drop from the selection whatever a lock or a hide just put out of
   *  reach, and the ids in `gone`. */
  narrowSelection(gone?: ReadonlySet<NodeId>): void;
  /** Drop the pose override of a node that is about to leave the scene: ids
   *  are reusable, and one left behind would attach itself to whatever is
   *  added under that id next. */
  clearOverride(id: NodeId): void;
  /** See `LockGuard.noteWritten`. */
  noteWritten(node: Node<TData, TLayer, TPose>): void;
}

/** Register every kit op kind. Answers with the table a live `kit:setLayout`
 *  payload's strategies are kept in, which `scene.setLayout` fills. */
export function registerKitOps<TData, TLayer extends string, TPose>(
  env: KitOpsEnv<TData, TLayer, TPose>,
): {
  layoutRefs: WeakMap<object, { from: LayoutStrategy<TPose> | null; to: LayoutStrategy<TPose> | null }>;
} {
  const { state, requireLayerIndex, invalidateOrder, fnFields } = env;
  const {
    dependents, childDerived, invalidateDependents, invalidateChildDerivedFrom, trackChildDerived, retarget,
    requireNode, detach, attach, addedFns, restoreNodeFunctions,
  } = env.store;

  function registerKitOp<P>(kind: string, handler: RegisteredOp<P>): void {
    env.register(kind, handler as RegisteredOp<unknown>);
  }

  registerKitOp<{
    id: NodeId; kind: 'mark' | 'group'; layer: TLayer; pose: TPose; data: TData;
    parent: NodeId | null; index: number;
    dependsOn?: readonly NodeId[] | 'children';
    pickable?: boolean; hidden?: boolean; locked?: boolean;
    units?: UnitScope; clip?: NodeClip; consumesChildren?: boolean;
  } & Record<string, unknown>>('kit:add', {
    apply: (p) => {
      if (state.nodes.has(p.id)) {
        throw new Error(`Scene: id collision on "${p.id}"`);
      }
      const node = {
        kind: p.kind, id: p.id, layer: p.layer, pose: p.pose, data: p.data, parent: p.parent,
      } as Node<TData, TLayer, TPose>;
      state.nodes.set(p.id, node);
      attach(p.id, p.parent, p.index);
      if (p.dependsOn !== undefined) node.dependsOn = p.dependsOn;
      Object.assign(node, statedFields(p));
      env.noteWritten(node);
      dependents.add(p.id, p.dependsOn === 'children' ? [] : p.dependsOn ?? []);
      trackChildDerived(p.id, p.dependsOn);
      // Two ways a function field comes back. Redo of a live add reads
      // what `scene.add` attached, since it replays the op without a spec.
      // A restored history has only the registry key the payload carries.
      const target = node as unknown as FnBearingNode;
      const attached = addedFns.get(p);
      for (const field of fnFields) {
        const fn = attached?.get(field);
        if (fn !== undefined) {
          field.write(target, fn);
          continue;
        }
        const key = p[field.spec.opKey] as string | undefined;
        if (key !== undefined) restoreFn(field, target, key, 'kit:add', dwarn);
      }
      invalidateDependents(p.id);
    },
    revert: (p) => {
      env.clearOverride(p.id);
      detach(p.id);
      state.nodes.delete(p.id);
      dependents.remove(p.id);
      childDerived.delete(p.id);
      invalidateChildDerivedFrom(p.parent);
      invalidateDependents(p.id);
    },
  });

  // Neither half invalidates dependents: removal's closure takes every live one.
  registerKitOp<RemoveSnapshot<TData, TLayer, TPose>>('kit:remove', {
    apply: (p) => {
      for (const n of p.nodes) env.clearOverride(n.id);
      for (const d of p.detached) detach(d.id);
      for (const n of p.nodes) {
        state.nodes.delete(n.id);
        dependents.remove(n.id);
        childDerived.delete(n.id);
      }
      // A `dependsOn: 'children'` container the removal did not take is now
      // hugging a smaller set.
      for (const d of p.detached) invalidateChildDerivedFrom(d.parent);
      env.narrowSelection(new Set(p.nodes.map((n) => n.id)));
    },
    revert: (p) => {
      const keys = new Map((p.fnKeys ?? []).map((k) => [k.id, k]));
      // Order-independent: every clone carries its own parent and children.
      for (const n of p.nodes) {
        const clone: Node<TData, TLayer, TPose> = n.children
          ? { ...n, children: [...n.children] }
          : { ...n };
        restoreNodeFunctions(clone, keys.get(n.id));
        state.nodes.set(n.id, clone);
        env.noteWritten(clone);
        dependents.add(n.id, clone.dependsOn === 'children' ? [] : clone.dependsOn ?? []);
        trackChildDerived(n.id, clone.dependsOn);
      }
      for (const d of p.detached) attach(d.id, d.parent, d.index);
      for (const d of p.detached) invalidateChildDerivedFrom(d.parent);
    },
  });

  registerKitOp<{ id: NodeId; from: TPose; to: TPose }>('kit:setPose', {
    apply: (p) => {
      (requireNode(p.id) as { pose: TPose }).pose = p.to;
      invalidateDependents(p.id);
    },
    revert: (p) => {
      (requireNode(p.id) as { pose: TPose }).pose = p.from;
      invalidateDependents(p.id);
    },
  });

  // A derivation is handed its dependencies' nodes, not only their poses, so a
  // connector reading `data` or `layer` goes stale on these two exactly as it
  // does on a move.
  registerKitOp<{ id: NodeId; from: TData; to: TData }>('kit:setData', {
    apply: (p) => {
      (requireNode(p.id) as { data: TData }).data = p.to;
      invalidateDependents(p.id);
    },
    revert: (p) => {
      (requireNode(p.id) as { data: TData }).data = p.from;
      invalidateDependents(p.id);
    },
  });

  registerKitOp<{ id: NodeId; from: TLayer; to: TLayer }>('kit:setLayer', {
    apply: (p) => {
      requireLayerIndex(p.to);
      (requireNode(p.id) as { layer: TLayer }).layer = p.to;
      invalidateOrder();
      invalidateDependents(p.id);
    },
    revert: (p) => {
      (requireNode(p.id) as { layer: TLayer }).layer = p.from;
      invalidateOrder();
      invalidateDependents(p.id);
    },
  });

  registerKitOp<{
    id: NodeId;
    from: Node<TData, TLayer, TPose>['dependsOn'];
    to: Node<TData, TLayer, TPose>['dependsOn'];
  }>('kit:setDependsOn', {
    apply: (p) => { retarget(p.id, p.to); },
    revert: (p) => { retarget(p.id, p.from); },
  });

  /** The strategies each live `kit:setLayout` payload swaps between. A payload
   *  replayed from a persisted history has none, and resolves its keys. */
  const layoutRefs = new WeakMap<object, { from: LayoutStrategy<TPose> | null; to: LayoutStrategy<TPose> | null }>();
  function placeLayout(p: SetLayoutPayload, side: 'from' | 'to'): void {
    const node = requireNode(p.id) as unknown as FnBearingNode;
    const field = fnFields.find((f) => f.spec.field === 'layout')!;
    const live = layoutRefs.get(p);
    const key = side === 'from' ? p.fromKey : p.toKey;
    if (live === undefined && key !== undefined) {
      delete node.layout;
      restoreFn(field, node, key, 'kit:setLayout', dwarn);
      return;
    }
    const layout = live?.[side] ?? null;
    if (layout === null) delete node.layout;
    else field.write(node, layout);
  }
  registerKitOp<SetLayoutPayload>('kit:setLayout', {
    apply: (p) => { placeLayout(p, 'to'); },
    revert: (p) => { placeLayout(p, 'from'); },
  });

  registerKitOp<{
    id: NodeId; fromParent: NodeId | null; fromIndex: number;
    toParent: NodeId | null; toIndex: number;
  }>('kit:move', {
    apply: (p) => {
      detach(p.id);
      attach(p.id, p.toParent, p.toIndex);
      // Both ends: the container it left no longer hugs it, and the one it
      // joined now does.
      invalidateChildDerivedFrom(p.fromParent);
      invalidateDependents(p.id);
    },
    revert: (p) => {
      detach(p.id);
      attach(p.id, p.fromParent, p.fromIndex);
      invalidateChildDerivedFrom(p.toParent);
      invalidateDependents(p.id);
    },
  });

  registerLayerOps(env);

  return { layoutRefs };
}
