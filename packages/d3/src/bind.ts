import { asNodeId } from '@weasel-js/core';
import type { NodeId, Scene } from '@weasel-js/core';
import { cancelPendingRemoval } from './pendingRemovals';
import { createSelection } from './selection';
import type {
  D3BindOptions,
  D3Binding,
  D3Selection,
} from './types';

/** What a binding's builder calls hold at `join()`: how each datum becomes a pose and a payload. */
interface JoinMappers<TData, TPose, TPayload> {
  pose: ((d: TData, i: number) => TPose) | null;
  payload: ((d: TData, i: number) => TPayload) | null;
  enterFrom: ((d: TData, i: number) => TPose) | null;
}

/** A join's diff: each datum's node id, which data enter and update (by index), and which nodes exit. */
interface JoinDiff {
  keys: NodeId[];
  enter: number[];
  update: number[];
  exit: NodeId[];
}

/**
 * Bind a data array to a scene. Returns a builder; configure with `.pose()` /
 * `.payload()` / `.enterFrom()`, then call `.join()` to emit the diff.
 *
 * Diff semantics (by `options.key`):
 * - data has key not in scene → ENTER (scene.add)
 * - data has key in scene → UPDATE (scene.setPose + scene.update)
 * - scene has leaf on the target layer with key not in data → EXIT (scene.remove,
 *   or handed to the `.exit()` callback, which decides when they go)
 *
 * All mutations dispatch through `scene.batch('d3Bind.join', ...)` so one join
 * is one undo entry.
 */
export function d3Bind<
  TData,
  TLayer extends string,
  TPose,
  TPayload = Record<string, unknown>,
>(
  scene: Scene<TPayload, TLayer, TPose>,
  data: readonly TData[],
  options: D3BindOptions<TData, TPose>,
): D3Binding<TData, TPose, TPayload> {
  const mappers: JoinMappers<TData, TPose, TPayload> = { pose: null, payload: null, enterFrom: null };
  let exitFn: ((exit: D3Selection<TPayload, TPose>) => void) | null = null;

  const binding: D3Binding<TData, TPose, TPayload> = {
    pose(fn) {
      mappers.pose = fn;
      return binding;
    },
    payload(fn) {
      mappers.payload = fn;
      return binding;
    },
    enterFrom(fn) {
      mappers.enterFrom = fn;
      return binding;
    },
    exit(fn) {
      exitFn = fn;
      return binding;
    },
    join() {
      const layer = (options.layer ?? scene.layers[0]?.id) as TLayer;
      if (!layer) throw new Error('d3Bind: scene has no layers; pass `layer` in options');

      const diff = diffJoin(scene, data, options.key, layer);
      // A node already on its way out stops that exit here: re-entering keys
      // rebind as UPDATE, and still-absent ones exit afresh.
      for (const id of [...diff.keys, ...diff.exit]) cancelPendingRemoval(scene, id);

      // Captured BEFORE the batch mutates them so `.transition()` can
      // interpolate from prior → new.
      const priorPoses = priorPosesOf(scene, data, diff, mappers);
      applyJoin(scene, data, diff, layer, mappers, exitFn === null);
      if (exitFn) exitFn(exitSelection(scene, diff.exit, options));

      return createSelection<TData, TPose>(
        scene,
        diff.keys,
        [...data],
        priorPoses,
        options.animator,
        options.poseDescriptor,
      );
    },
  };

  return binding;
}

/** Split `data` against the marks on `layer` into enter, update and exit. Throws on a duplicate or held key. */
function diffJoin<TData>(
  scene: Scene<unknown, string, unknown>,
  data: readonly TData[],
  key: (d: TData, i: number) => string,
  layer: string,
): JoinDiff {
  const keys = keysOf(data, key);
  const keySet = new Set(keys);
  const enter: number[] = [];
  const update: number[] = [];
  const exit: NodeId[] = [];

  data.forEach((_, i) => {
    const existing = scene.get(keys[i]);
    if (existing && existing.kind === 'mark' && existing.layer === layer) {
      update.push(i);
    } else {
      enter.push(i);
    }
  });
  refuseHeldKeys(scene, enter.map((i) => keys[i]), layer);
  for (const node of scene.nodesOnLayer(layer)) {
    if (node.kind === 'mark' && !keySet.has(node.id)) exit.push(node.id);
  }
  return { keys, enter, update, exit };
}

/** The pose each bound node transitions from: an updating node's current pose, an entering one's `enterFrom` or declared pose. */
function priorPosesOf<TData, TPose, TPayload>(
  scene: Scene<unknown, string, TPose>,
  data: readonly TData[],
  diff: JoinDiff,
  mappers: JoinMappers<TData, TPose, TPayload>,
): Map<NodeId, TPose> {
  const priorPoses = new Map<NodeId, TPose>();
  for (const i of diff.update) {
    const id = diff.keys[i];
    const node = scene.get(id);
    if (node) priorPoses.set(id, node.pose);
  }
  // Entering nodes use enterFrom if set, otherwise their declared pose (snap-in).
  for (const i of diff.enter) {
    const id = diff.keys[i];
    if (mappers.enterFrom) {
      priorPoses.set(id, mappers.enterFrom(data[i], i));
    } else if (mappers.pose) {
      priorPoses.set(id, mappers.pose(data[i], i));
    }
  }
  return priorPoses;
}

/** Add the entering marks, write the updating ones, and remove the exiting ones when `removeExits`, in one batch. */
function applyJoin<TData, TLayer extends string, TPose, TPayload>(
  scene: Scene<TPayload, TLayer, TPose>,
  data: readonly TData[],
  diff: JoinDiff,
  layer: TLayer,
  mappers: JoinMappers<TData, TPose, TPayload>,
  removeExits: boolean,
): void {
  const { pose: poseFn, payload: payloadFn } = mappers;
  scene.batch('d3Bind.join', () => {
    for (const i of diff.enter) {
      const id = diff.keys[i];
      const pose = poseFn ? poseFn(data[i], i) : (undefined as unknown as TPose);
      const payload = payloadFn ? payloadFn(data[i], i) : ({} as TPayload);
      if (pose === undefined) {
        throw new Error(
          'd3Bind.join: enter node has no pose. Call `.pose(fn)` before `.join()`.',
        );
      }
      scene.add({
        id,
        kind: 'mark',
        layer,
        pose,
        data: payload,
      });
    }
    for (const i of diff.update) {
      const id = diff.keys[i];
      if (poseFn) scene.setPose(id, poseFn(data[i], i));
      if (payloadFn) scene.update(id, { data: payloadFn(data[i], i) });
    }
    if (removeExits) {
      for (const id of diff.exit) scene.remove(id);
    }
  });
}

/** The exiting marks as a selection over their scene payloads, posed where they stand. */
function exitSelection<TPayload, TPose>(
  scene: Scene<TPayload, string, TPose>,
  exitIds: readonly NodeId[],
  options: Pick<D3BindOptions<unknown, TPose>, 'animator' | 'poseDescriptor'>,
): D3Selection<TPayload, TPose> {
  const exitPoses = new Map<NodeId, TPose>();
  const exitData: TPayload[] = [];
  for (const id of exitIds) {
    const node = scene.get(id)!;
    exitPoses.set(id, node.pose);
    exitData.push(node.data as TPayload);
  }
  return createSelection<TPayload, TPose>(
    scene,
    exitIds,
    exitData,
    exitPoses,
    options.animator,
    options.poseDescriptor,
  );
}

/** Throws on an entering key the scene already gives a node, which is not one of the binding's marks. */
function refuseHeldKeys(scene: Scene<unknown, string, unknown>, ids: readonly NodeId[], layer: string): void {
  for (const id of ids) {
    const held = scene.get(id);
    if (!held) continue;
    throw new Error(
      `d3Bind.join: key "${id}" is held by a ${held.kind} on layer "${held.layer}", not a mark on "${layer}"; a bound key must be free or one of the binding's own marks`,
    );
  }
}

/** Each datum's node id; throws on two data sharing one. */
function keysOf<TData>(data: readonly TData[], key: (d: TData, i: number) => string): NodeId[] {
  const firstAt = new Map<NodeId, number>();
  return data.map((d, i) => {
    const id = asNodeId(key(d, i));
    const first = firstAt.get(id);
    if (first !== undefined) {
      throw new Error(`d3Bind.join: key "${id}" is given to data ${first} and ${i}; each datum needs a key of its own`);
    }
    firstAt.set(id, i);
    return id;
  });
}
