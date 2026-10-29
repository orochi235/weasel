/**
 * The scene's edits to its tree: adding and removing nodes, reparenting, and
 * reordering siblings. Each checks its arguments, then records one kit op.
 */
import type { ArrivalWindow } from './arrivalWindow';
import type { RemoveSnapshot } from './kitOps';
import type { createLayerStack } from './layerStack';
import type { LockGuard } from './lockGuard';
import { fnKeysOf, type FnBearingNode, type NodeFnField } from './nodeFnFields';
import type { createNodeStore } from './nodeStore';
import type { Recorder } from './recorder';
import { SceneMembershipError } from './staleReplay';
import { statedFields } from './statedFields';
import type { AddNodeSpec, Node, NodeId, Scene } from './types';

export interface TreeEditsEnv<TData, TLayer extends string, TPose> {
  nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>;
  generateId(): NodeId;
  store: Pick<
    ReturnType<typeof createNodeStore<TData, TLayer, TPose>>,
    'requireNode' | 'siblingsOf' | 'descendants' | 'removalClosure' | 'patchNodeFunctions'
  >;
  locks: Pick<LockGuard<TLayer>, 'refuse' | 'refuseLayer' | 'lifted'>;
  layers: Pick<ReturnType<typeof createLayerStack<TLayer>>, 'requireLayerIndex' | 'assertSubtreeLayer'>;
  fnFields: readonly NodeFnField[];
  /** Run a registered op without recording it. */
  runOp(kind: string, payload: unknown): void;
  recorder: Pick<Recorder, 'record' | 'edit'>;
  arrivals: Pick<ArrivalWindow<TPose>, 'noteArrival' | 'noteDeparture' | 'noteChange'>;
}

export interface TreeEdits<TData, TLayer extends string, TPose>
  extends Pick<Scene<TData, TLayer, TPose>, 'add' | 'remove' | 'removalClosure' | 'removeMany' | 'move' | 'reorder'> {
  /** Place nodes as the document a scene starts from, or is loaded with:
   *  nothing is recorded, and no lock refuses. Specs list parents before
   *  children, the order `toJSON()` emits. */
  construct(specs: readonly AddNodeSpec<TData, TLayer, TPose>[]): void;
}

/** What `kit:remove` carries for the nodes `ids`, read before any of them
 *  goes. Throws on an id that is not in the scene. */
function removeSnapshot<TData, TLayer extends string, TPose>(
  ids: readonly NodeId[],
  removing: ReadonlySet<NodeId>,
  store: Pick<TreeEditsEnv<TData, TLayer, TPose>['store'], 'requireNode' | 'siblingsOf'>,
  fnFields: readonly NodeFnField[],
): RemoveSnapshot<TData, TLayer, TPose> {
  const nodes: Node<TData, TLayer, TPose>[] = ids.map((nid) => {
    const n = store.requireNode(nid);
    return n.children ? { ...n, children: [...n.children] } : { ...n };
  });
  // The rest is reachable through a snapshotted parent's cloned `children`.
  const detached = nodes
    .filter((n) => n.parent === null || !removing.has(n.parent))
    .map((n) => ({ id: n.id, parent: n.parent, index: store.siblingsOf(n.parent).indexOf(n.id) }))
    .sort((l, r) => l.index - r.index);
  const fnKeys = nodes.flatMap((n) => {
    const keys = fnKeysOf(fnFields, n as unknown as FnBearingNode, 'opKey');
    return Object.keys(keys).length === 0 ? [] : [{ id: n.id, ...keys }];
  });
  return { nodes, detached, ...(fnKeys.length > 0 ? { fnKeys } : {}) };
}

export function createTreeEdits<TData, TLayer extends string, TPose>(
  env: TreeEditsEnv<TData, TLayer, TPose>,
): TreeEdits<TData, TLayer, TPose> {
  const { nodes, fnFields } = env;
  const { requireNode, siblingsOf, descendants, removalClosure, patchNodeFunctions } = env.store;
  const { refuse, refuseLayer } = env.locks;
  const { requireLayerIndex, assertSubtreeLayer } = env.layers;
  const { record, edit } = env.recorder;
  const { noteArrival, noteDeparture, noteChange } = env.arrivals;

  /** Check that `spec` can be placed, and answer with the `kit:add` payload
   *  that places it. Throws on an id collision, an unknown or locked layer,
   *  a locked parent, and a layer below the
   *  parent's. */
  function addPayload(spec: AddNodeSpec<TData, TLayer, TPose>) {
    const id = spec.id ?? env.generateId();
    if (nodes.has(id)) throw new SceneMembershipError(`Scene: id collision on "${id}"`);
    requireLayerIndex(spec.layer);
    refuseLayer(spec.layer, 'add to');
    const parent = spec.parent ?? null;
    if (parent !== null) {
      const p = requireNode(parent);
      assertSubtreeLayer(spec.id, spec.layer, parent, p.layer);
      refuse(parent, 'add under');
    }
    const payload: {
      id: NodeId; kind: 'mark' | 'group'; layer: TLayer; pose: TPose; data: TData;
      parent: NodeId | null; index: number; dependsOn?: AddNodeSpec<TData, TLayer, TPose>['dependsOn'];
    } = {
      id, kind: spec.kind, layer: spec.layer, pose: spec.pose, data: spec.data,
      parent, index: spec.index ?? siblingsOf(parent).length,
    };
    if (spec.dependsOn !== undefined) payload.dependsOn = spec.dependsOn;
    // Assigned rather than spread into the literal: a spread after named fields is V8's slow clone.
    return Object.assign(payload, statedFields(spec), fnKeysOf(fnFields, spec as unknown as FnBearingNode, 'opKey'));
  }

  function removeMany(rootIds: readonly NodeId[]): void {
    if (rootIds.length === 0) return;
    // Every id resolves against the pre-removal tree, so an id another one
    // cascades away is absorbed rather than being a second, failing removal.
    const { ids, removing } = removalClosure(rootIds);
    for (const nid of ids) refuse(nid, 'remove');
    const payload = removeSnapshot(ids, removing, env.store, fnFields);
    const { detached } = payload;
    edit('remove', detached.some((d) => d.parent !== null), () => {
      for (const d of detached) noteDeparture(d.id, d.parent, null);
      record('kit:remove', payload, 'remove');
    });
  }

  return {
    construct(specs) {
      env.locks.lifted(() => {
        for (const spec of specs) {
          const payload = addPayload(spec);
          env.runOp('kit:add', payload);
          patchNodeFunctions(spec, payload.id, null);
        }
      });
    },

    add(spec) {
      const payload = addPayload(spec);
      const label = `add ${spec.kind}`;
      return edit(label, payload.parent !== null, () => {
        noteArrival(payload.id, payload.parent, null);
        record('kit:add', payload, label);
        patchNodeFunctions(spec, payload.id, payload);
        return payload.id;
      });
    },

    remove: (id) => removeMany([id]),

    removalClosure: (rootIds) => removalClosure(rootIds).ids,

    removeMany,

    move(id, parent, index) {
      const node = requireNode(id);
      refuse(id, 'move');
      if (parent !== null) {
        refuse(parent, 'move nodes into');
        const p = requireNode(parent);
        assertSubtreeLayer(id, node.layer, parent, p.layer);
        if (parent === id) throw new Error('Scene: cannot parent a node to itself');
        const desc: NodeId[] = [];
        descendants(id, desc);
        if (desc.includes(parent)) {
          throw new Error('Scene: cannot parent a node to its own descendant');
        }
      }
      const fromParent = node.parent;
      edit('move', parent !== null || fromParent !== null, () => {
        const fromIndex = siblingsOf(fromParent).indexOf(id);
        const toIndex = index ?? siblingsOf(parent).length;
        noteArrival(id, parent, fromParent);
        noteDeparture(id, fromParent, parent);
        noteChange(fromParent);
        record('kit:move', { id, fromParent, fromIndex, toParent: parent, toIndex }, 'move');
      });
    },

    reorder(id, index) {
      const node = requireNode(id);
      refuse(id, 'reorder');
      const parent = node.parent;
      edit('reorder', parent !== null, () => {
        noteChange(parent);
        const fromIndex = siblingsOf(parent).indexOf(id);
        record('kit:move', { id, fromParent: parent, fromIndex, toParent: parent, toIndex: index }, 'reorder');
      });
    },
  };
}
