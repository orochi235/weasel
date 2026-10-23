/**
 * The scene's edits to one node's fields: its data, pose, layer, dependency
 * list, layout, and unit scope. Each checks its arguments, then records.
 */
import type { LayoutStrategy } from '../../layout/types';
import type { ArrivalWindow } from './arrivalWindow';
import { sameDependsOn } from './dependents';
import type { SetLayoutPayload } from './kitOps';
import type { createLayerStack } from './layerStack';
import { resized, type ResolvedLayoutFrame } from './layoutPass';
import type { LockGuard } from './lockGuard';
import type { NodeFnField } from './nodeFnFields';
import type { createNodeStore } from './nodeStore';
import type { Recorder } from './recorder';
import type { NodeId, Scene } from './types';

export interface FieldEditsEnv<TData, TLayer extends string, TPose> {
  store: Pick<ReturnType<typeof createNodeStore<TData, TLayer, TPose>>, 'requireNode' | 'descendants'>;
  locks: Pick<LockGuard<TLayer>, 'refuse' | 'refuseLayer'>;
  layers: Pick<ReturnType<typeof createLayerStack<TLayer>>, 'requireLayerIndex' | 'assertSubtreeLayer'>;
  recorder: Pick<Recorder, 'record' | 'edit' | 'batch'>;
  arrivals: Pick<ArrivalWindow<TPose>, 'noteChange' | 'layoutDeclared'>;
  layoutFrame: ResolvedLayoutFrame<TPose>;
  /** The registry's layouts, by key and back. */
  layoutField: NodeFnField;
  /** Where a live `kit:setLayout` payload's strategies are kept. */
  layoutRefs: WeakMap<object, { from: LayoutStrategy<TPose> | null; to: LayoutStrategy<TPose> | null }>;
}

export type FieldEdits<TData, TLayer extends string, TPose> = Pick<
  Scene<TData, TLayer, TPose>,
  'update' | 'setPose' | 'setLayer' | 'setDependsOn' | 'setLayout' | 'setUnits'
>;

export function createFieldEdits<TData, TLayer extends string, TPose>(
  env: FieldEditsEnv<TData, TLayer, TPose>,
): FieldEdits<TData, TLayer, TPose> {
  const { layoutFrame, layoutField, layoutRefs } = env;
  const { requireNode, descendants } = env.store;
  const { refuse, refuseLayer } = env.locks;
  const { requireLayerIndex, assertSubtreeLayer } = env.layers;
  const { record, edit, batch } = env.recorder;
  const { noteChange, layoutDeclared } = env.arrivals;

  return {
    update(id, patch) {
      const node = requireNode(id);
      refuse(id, 'update');
      record('kit:setData', { id, from: node.data, to: patch.data }, 'update');
    },

    setPose(id, pose) {
      const node = requireNode(id);
      refuse(id, 'set the pose of');
      const resizes = node.kind === 'group' && resized(layoutFrame, id, node.pose, pose);
      // A container with a layout owns where its children go, however one is moved.
      const parent = node.parent === null ? undefined : requireNode(node.parent);
      const arranger = parent?.kind === 'group' && parent.layout !== undefined ? parent.id : null;
      edit('setPose', resizes || arranger !== null, () => {
        if (resizes) noteChange(id);
        noteChange(arranger);
        record('kit:setPose', { id, from: node.pose, to: pose }, 'setPose');
      });
    },

    setLayer(id, layer) {
      requireLayerIndex(layer);
      const node = requireNode(id);
      refuse(id, 'relayer');
      if (node.layer !== layer) refuseLayer(layer, 'move nodes onto');
      if (node.parent !== null) {
        const parentNode = requireNode(node.parent);
        assertSubtreeLayer(id, layer, node.parent, parentNode.layer, 'relayer');
      }
      if (node.layer === layer) return;
      const subtree: NodeId[] = [id];
      descendants(id, subtree);
      for (const sid of subtree) refuse(sid, 'relayer');
      if (subtree.length === 1) {
        record('kit:setLayer', { id, from: node.layer, to: layer }, 'setLayer');
      } else {
        batch('setLayer', () => {
          for (const sid of subtree) {
            const cur = requireNode(sid);
            if (cur.layer === layer) continue;
            record('kit:setLayer', { id: sid, from: cur.layer, to: layer }, 'setLayer');
          }
        });
      }
    },

    setDependsOn(id, dependsOn) {
      const node = requireNode(id);
      refuse(id, 'retarget');
      if (sameDependsOn(node.dependsOn, dependsOn)) return;
      record('kit:setDependsOn', { id, from: node.dependsOn, to: dependsOn }, 'setDependsOn');
    },

    setLayout(id, layout) {
      const node = requireNode(id);
      if (node.kind !== 'group') throw new Error(`Scene: "${id}" is not a container`);
      refuse(id, 'set the layout of');
      let to: LayoutStrategy<TPose> | null;
      if (typeof layout === 'string') {
        to = (layoutField.fnOf(layout) as LayoutStrategy<TPose> | undefined) ?? null;
        if (to === null) throw new Error(`Scene: no layout "${layout}" in this scene's registry`);
      } else {
        to = layout;
      }
      const from = node.layout ?? null;
      if (from === to) return;
      if (to !== null) layoutDeclared();
      const fromKey = from === null ? undefined : layoutField.keyOf(from);
      const toKey = to === null ? undefined : layoutField.keyOf(to);
      const payload: SetLayoutPayload = {
        id,
        ...(fromKey !== undefined ? { fromKey } : {}),
        ...(toKey !== undefined ? { toKey } : {}),
      };
      layoutRefs.set(payload, { from, to });
      edit('setLayout', true, () => {
        noteChange(id);
        record('kit:setLayout', payload, 'setLayout');
      });
    },

    setUnits(id, units) {
      const node = requireNode(id);
      if (node.kind !== 'group') throw new Error(`Scene: "${id}" is not a container`);
      refuse(id, 'set the units of');
      record('kit:setUnits', { id, from: node.units, to: units ?? undefined }, 'setUnits');
    },
  };
}
