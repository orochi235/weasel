import { asNodeId, RECT_POSE_DESCRIPTOR } from '@weasel-js/core';
import type { Animator, NodeId, PoseProjection, Scene } from '@weasel-js/core';
import { createTransition, takeCustomKeys } from './transition';
import type {
  BindOptions,
  D3Binding,
  D3Selection,
} from './types';

/**
 * Bind a data array to a scene. Returns a builder; configure with `.pose()` /
 * `.data()` / `.enterFrom()`, then call `.join()` to emit the diff.
 *
 * Diff semantics (by `options.key`):
 * - data has key not in scene → ENTER (scene.add)
 * - data has key in scene → UPDATE (scene.setPose + scene.update)
 * - scene has leaf on the target layer with key not in data → EXIT (scene.remove)
 *
 * All mutations dispatch through `scene.batch('d3Bind.join', ...)` so one join
 * is one undo entry.
 */
export function d3Bind<TData, TLayer extends string, TPose>(
  scene: Scene<unknown, TLayer, TPose>,
  data: readonly TData[],
  options: BindOptions<TData, TPose>,
): D3Binding<TData, TPose> {
  let poseFn: ((d: TData, i: number) => TPose) | null = null;
  let dataFn: ((d: TData, i: number) => Record<string, unknown>) | null = null;
  let enterFromFn: ((d: TData, i: number) => TPose) | null = null;

  const binding: D3Binding<TData, TPose> = {
    pose(fn) {
      poseFn = fn;
      return binding;
    },
    data(fn) {
      dataFn = fn;
      return binding;
    },
    enterFrom(fn) {
      enterFromFn = fn;
      return binding;
    },
    join() {
      const layer = (options.layer ?? scene.layers[0]?.id) as TLayer;
      if (!layer) {
        throw new Error('d3Bind: scene has no layers; pass `layer` in options');
      }

      // Compute the diff.
      const dataKeys = data.map((d, i) => asNodeId(options.key(d, i)));
      const dataKeySet = new Set(dataKeys);
      const enterIndices: number[] = [];
      const updateIndices: number[] = [];
      const exitIds: NodeId[] = [];

      const sceneLeafIdsOnLayer = new Set<NodeId>();
      for (const node of scene.nodes.values()) {
        if (node.kind === 'leaf' && node.layer === layer) {
          sceneLeafIdsOnLayer.add(node.id);
        }
      }

      data.forEach((_, i) => {
        if (sceneLeafIdsOnLayer.has(dataKeys[i])) updateIndices.push(i);
        else enterIndices.push(i);
      });
      sceneLeafIdsOnLayer.forEach((id) => {
        if (!dataKeySet.has(id)) exitIds.push(id);
      });

      // Snapshot prior poses for nodes that will be updated. Captured BEFORE the
      // batch mutates them so `.transition()` can interpolate from prior → new.
      const priorPoses = new Map<NodeId, TPose>();
      for (const i of updateIndices) {
        const id = dataKeys[i];
        const node = scene.get(id);
        if (node) priorPoses.set(id, node.pose);
      }
      // Entering nodes use enterFrom if set, otherwise their declared pose (snap-in).
      for (const i of enterIndices) {
        const id = dataKeys[i];
        if (enterFromFn) {
          priorPoses.set(id, enterFromFn(data[i], i));
        } else if (poseFn) {
          priorPoses.set(id, poseFn(data[i], i));
        }
      }

      // Apply mutations in one batched op group.
      scene.batch('d3Bind.join', () => {
        for (const i of enterIndices) {
          const id = dataKeys[i];
          const pose = poseFn ? poseFn(data[i], i) : (undefined as unknown as TPose);
          const payload = dataFn ? dataFn(data[i], i) : ({} as Record<string, unknown>);
          if (pose === undefined) {
            throw new Error(
              'd3Bind.join: enter node has no pose. Call `.pose(fn)` before `.join()`.',
            );
          }
          scene.add({
            id,
            kind: 'leaf',
            layer,
            pose,
            // The scene is typed `Scene<unknown, TLayer, TPose>` — payload is
            // unknown to the kit and consumer's drawOne reads it as a typed
            // record.
            data: payload as never,
          });
        }
        for (const i of updateIndices) {
          const id = dataKeys[i];
          if (poseFn) scene.setPose(id, poseFn(data[i], i));
          if (dataFn) scene.update(id, { data: dataFn(data[i], i) as never });
        }
        for (const id of exitIds) {
          scene.remove(id);
        }
      });

      return createSelection<TData, TPose>(
        scene,
        dataKeys,
        [...data],
        priorPoses,
        options.animator,
        options.geometry,
      );
    },
  };

  return binding;
}

/** @internal — exported for `selection.filter` reuse. */
function createSelection<TData, TPose>(
  scene: Scene<unknown, string, TPose>,
  ids: readonly NodeId[],
  data: readonly TData[],
  priorPoses: ReadonlyMap<NodeId, TPose>,
  animator: Animator | undefined,
  geometry: PoseProjection<TPose> | undefined,
): D3Selection<TData, TPose> {
  const sel: D3Selection<TData, TPose> = {
    ids,
    data,
    filter(pred) {
      const subset: NodeId[] = [];
      const subData: TData[] = [];
      for (let i = 0; i < data.length; i++) {
        if (pred(data[i], i)) {
          subset.push(ids[i]);
          subData.push(data[i]);
        }
      }
      return createSelection(scene, subset, subData, priorPoses, animator, geometry);
    },
    each(fn) {
      for (let i = 0; i < ids.length; i++) fn(data[i], ids[i], i);
      return sel;
    },
    transition(name?: string) {
      if (!animator) {
        throw new Error(
          'd3Bind.transition: pass `animator` in BindOptions to enable transitions',
        );
      }
      const resolvedGeometry = (geometry ??
        (RECT_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>));
      return createTransition({
        scene,
        animator,
        geometry: resolvedGeometry,
        ids,
        data,
        priorPoses,
        name: name ?? '',
      });
    },
    interrupt(name?: string) {
      if (!animator) return sel;
      const transitionName = name ?? '';
      // `animator.cancelKey` matches exactly, so the custom tweens — whose
      // keys carry a `:<tweenName>` suffix — need naming individually.
      for (const id of ids) {
        const ns = `d3-transition:${transitionName}:${id}`;
        for (const key of takeCustomKeys(ns)) animator.cancelKey(key);
        animator.cancelKey(ns);
      }
      return sel;
    },
  };
  return sel;
}
