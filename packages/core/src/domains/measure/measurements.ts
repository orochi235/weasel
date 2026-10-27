import { createEmitter } from '@weasel-js/registry';
import type { NodeId, Scene } from 'core/scene/types';
import { measurementOf, type Measurement } from './measurement';

/** One value, readable and watchable — what a readout re-renders from. */
export interface MeasureCell<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

function cell<T>(initial: T): MeasureCell<T> {
  let value = initial;
  const changed = createEmitter();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      changed.emit();
    },
    subscribe: changed.subscribe,
  };
}

/**
 * Where a scene's measurements go, and the state around them that is not
 * the document's: which one is picked, and the one a measure drag is still
 * drawing. The measurements themselves are nodes on `layer`, an annotation
 * layer (`isAnnotationLayer`), so they save with the scene, undo with it,
 * and stay out of export and content picking.
 *
 * The pick sits beside the content selection rather than in it: picking a
 * measurement leaves the selection alone, so Move by can carry the selection
 * by the picked measurement.
 */
export interface Measurements {
  /** The annotation layer new measurements are added to. */
  readonly layer: string;
  /** The picked measurement's id. */
  readonly picked: MeasureCell<NodeId | null>;
  /** The measurement a measure drag is drawing, before it is added. */
  readonly draft: MeasureCell<Measurement | null>;
  /** Whether the measure tool is active, which changes what a press on a
   *  measurement does: under it, only the picked one's ends take a drag, so a
   *  drag from anywhere else starts a new measurement. */
  readonly measuring: MeasureCell<boolean>;
}

/** The measurements on `layer`, none picked and none in progress. */
export function createMeasurements(options: { layer: string }): Measurements {
  return {
    layer: options.layer,
    picked: cell<NodeId | null>(null),
    draft: cell<Measurement | null>(null),
    measuring: cell(false),
  };
}


/** The measurement nodes on `ms.layer`, oldest first. */
export function measureIds(scene: Pick<Scene<unknown, string, unknown>, 'nodesOnLayer'>, ms: Pick<Measurements, 'layer'>): NodeId[] {
  return scene.nodesOnLayer(ms.layer).filter((n) => measurementOf(n) !== null).map((n) => n.id);
}

/** The measurement commands act on: the picked one while it is still in the
 *  scene, else the newest. */
export function currentMeasureId(
  scene: Pick<Scene<unknown, string, unknown>, 'nodesOnLayer' | 'get'>,
  ms: Pick<Measurements, 'layer' | 'picked'>,
): NodeId | null {
  const picked = ms.picked.get();
  if (picked !== null && measurementOf(scene.get(picked)) !== null) return picked;
  return measureIds(scene, ms).at(-1) ?? null;
}
