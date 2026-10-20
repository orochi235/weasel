/**
 * A scene's document state — its nodes, roots, and layers — with the modules
 * that read and write it directly.
 */
import { createDocStore, type SerializedDoc } from './docValues';
import { createLayerStack } from './layerStack';
import { createLockGuard } from './lockGuard';
import { createNodeFnFields } from './nodeFnFields';
import { createNodeStore } from './nodeStore';
import { createRenderOrder } from './renderOrder';
import { serializeScene } from './serialization';
import { createStaleReplay } from './staleReplay';
import { createTreeReads } from './treeReads';
import type { LayerRecord, Node, NodeId, Scene, SceneRegistry } from './types';

export function createSceneState<TData, TLayer extends string, TPose>(
  registry: SceneRegistry<TPose, TData, TLayer>,
  initialLayers: readonly LayerRecord<TLayer>[],
  /** Called when a node is given a layout. */
  layoutDeclared: () => void,
  initialDoc?: SerializedDoc,
) {
  const state = {
    nodes: new Map<NodeId, Node<TData, TLayer, TPose>>(),
    roots: [] as NodeId[],
    layers: [] as LayerRecord<TLayer>[],
    layerIndex: new Map<TLayer, number>(),
    docValues: new Map<string, unknown>(),
  };
  const order = createRenderOrder(state);
  /** The registry-keyed function fields, each with its key maps. A function
   *  cannot travel through a serializable op payload, so an op carries its key. */
  const fnFields = createNodeFnFields<TPose>(registry, (field) => {
    if (field === 'layout') layoutDeclared();
  });
  const store = createNodeStore(state, order.invalidate, fnFields);
  const layers = createLayerStack(state, order.invalidate);
  layers.reset(initialLayers);
  const locks = createLockGuard(state);
  const docValues = createDocStore(state.docValues);
  docValues.reset(initialDoc);

  const reads: Pick<
    Scene<TData, TLayer, TPose>,
    | 'get' | 'incarnation' | 'childrenOf' | 'ancestorsOf' | 'renderOrder' | 'renderOrderNodes'
    | 'nodesOnLayer' | 'isLocked' | 'isHidden' | 'layoutOf' | 'toJSON'
  > = {
    ...createTreeReads(state.nodes),
    renderOrder: order.ids,
    renderOrderNodes: order.nodes,
    nodesOnLayer: order.nodesOnLayer,
    isLocked: (id) => locks.isLocked(id),
    isHidden: (id) => locks.isHidden(id),
    layoutOf(id) {
      const node = state.nodes.get(id);
      return node?.kind === 'container' ? (node.layout ?? null) : null;
    },
    toJSON: () => serializeScene(state, fnFields, docValues.toJSON()),
  };

  return {
    state,
    order,
    locks,
    stale: createStaleReplay(state.nodes),
    fnFields,
    store,
    layers,
    reads,
    docValues,

    /** Empty the document and give it `records` as its layers and `values` as its document values. */
    reset(records: readonly LayerRecord<TLayer>[], values?: SerializedDoc): void {
      docValues.reset(values);
      store.dependents.clear();
      store.childDerived.clear();
      state.nodes.clear();
      state.roots.length = 0;
      layers.reset(records);
    },
  };
}
