/**
 * The scene's edits to its document — tree, node fields, and layers — with
 * the kit ops they record.
 */
import type { ArrivalWindow } from './arrivalWindow';
import { createFieldEdits, type FieldEdits } from './fieldEdits';
import { registerKitOps } from './kitOps';
import { createNodeFlags } from './nodeFlags';
import { createLayerEdits, type LayerEdits, type createLayerStack } from './layerStack';
import type { ResolvedLayoutFrame } from './layoutPass';
import type { LockGuard } from './lockGuard';
import type { NodeFnField } from './nodeFnFields';
import type { createNodeStore } from './nodeStore';
import type { OpTable } from './opTable';
import type { Recorder } from './recorder';
import { createTreeEdits, type TreeEdits } from './treeEdits';
import type { LayerRecord, Node, NodeId } from './types';

export interface SceneEditsEnv<TData, TLayer extends string, TPose> {
  state: {
    nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
    layers: LayerRecord<TLayer>[];
    layerIndex: Map<TLayer, number>;
  };
  store: ReturnType<typeof createNodeStore<TData, TLayer, TPose>>;
  locks: Pick<LockGuard<TLayer>, 'refuse' | 'refuseLayer' | 'lifted'>;
  layers: Pick<
    ReturnType<typeof createLayerStack<TLayer>>,
    'requireLayerIndex' | 'rebuildLayerIndex' | 'assertSubtreeLayer'
  >;
  invalidateOrder(): void;
  fnFields: readonly NodeFnField[];
  ops: Pick<OpTable, 'register' | 'run'>;
  recorder: Pick<Recorder, 'record' | 'edit' | 'batch'>;
  arrivals: Pick<ArrivalWindow<TPose>, 'noteArrival' | 'noteDeparture' | 'noteChange' | 'layoutDeclared'>;
  layoutFrame: ResolvedLayoutFrame<TPose>;
  generateId(): NodeId;
  narrowSelection(gone?: ReadonlySet<NodeId>): void;
  clearOverride(id: NodeId): void;
}

export interface SceneEdits<TData, TLayer extends string, TPose> {
  construct: TreeEdits<TData, TLayer, TPose>['construct'];
  methods: Omit<TreeEdits<TData, TLayer, TPose>, 'construct'>
    & FieldEdits<TData, TLayer, TPose>
    & LayerEdits<TData, TLayer, TPose>
    & ReturnType<typeof createNodeFlags<TData, TLayer, TPose>>;
}

export function createSceneEdits<TData, TLayer extends string, TPose>(
  env: SceneEditsEnv<TData, TLayer, TPose>,
): SceneEdits<TData, TLayer, TPose> {
  const { state, store, locks, layers, fnFields, recorder, arrivals } = env;

  const { layoutRefs } = registerKitOps<TData, TLayer, TPose>({
    state,
    register: env.ops.register,
    store,
    requireLayerIndex: layers.requireLayerIndex,
    rebuildLayerIndex: layers.rebuildLayerIndex,
    invalidateOrder: env.invalidateOrder,
    fnFields,
    narrowSelection: env.narrowSelection,
    clearOverride: env.clearOverride,
  });

  const { construct, ...treeEdits } = createTreeEdits<TData, TLayer, TPose>({
    nodes: state.nodes,
    generateId: env.generateId,
    store,
    locks,
    layers,
    fnFields,
    runOp: env.ops.run,
    recorder,
    arrivals,
  });

  const fieldEdits = createFieldEdits<TData, TLayer, TPose>({
    store,
    locks,
    layers,
    recorder,
    arrivals,
    layoutFrame: env.layoutFrame,
    layoutField: fnFields.find((f) => f.spec.field === 'layout')!,
    layoutRefs,
  });

  const layerEdits = createLayerEdits<TData, TLayer, TPose>({
    layers: state.layers,
    layerIndex: state.layerIndex,
    nodes: state.nodes,
    requireLayerIndex: layers.requireLayerIndex,
    record: recorder.record,
    lifted: locks.lifted,
    batch: recorder.batch,
    removeMany: treeEdits.removeMany,
  });

  const flagEdits = createNodeFlags<TData, TLayer, TPose>({
    register: env.ops.register,
    requireNode: store.requireNode,
    record: recorder.record,
    narrowSelection: () => env.narrowSelection(),
  });

  return { construct, methods: { ...treeEdits, ...fieldEdits, ...layerEdits, ...flagEdits } };
}
