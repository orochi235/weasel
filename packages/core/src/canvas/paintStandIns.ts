/**
 * Paint stand-ins: something drawn over a canvas in place of part of a node's paint, such as an editing
 * overlay showing a text node's glyphs while the canvas leaves them out. A stand-in names its scene and the
 * element it is mounted in; every canvas of that scene inside that element paints the node it shows through
 * the stand-in's `keep`.
 */
import { useMemo, useSyncExternalStore, type MutableRefObject } from 'react';
import { createEmitter } from '@weasel-js/registry';
import type { DrawCommand } from '@weasel-js/renderer';
import type { Node } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { NodePaintCtx } from './nodeShapeTypes';
import { defaultDrawOne, defaultPaintBounds, paintBoundsFor } from './defaultDrawOne';
import { isCustomEntry } from './layerSlots';
import type { SceneCanvasLayers } from './SceneCanvas/props';

/** What of a node's paint the canvas keeps while a stand-in shows it. */
export type KeepPaint = (cmds: readonly DrawCommand[]) => DrawCommand[];

/** A stand-in, registered with {@link registerPaintStandIn}. */
export interface PaintStandIn {
  /** Show node `id` through the stand-in, or none. */
  show(id: string | null): void;
  dispose(): void;
}

interface Entry { readonly scene: object; readonly within: Element; readonly keep: KeepPaint; shown: string | null }

const entries = new Set<Entry>();
const changes = createEmitter();
let version = 0;
const changed = (): void => { version++; changes.emit(); };

/** Stand in, inside `within`, for the paint `keep` leaves out of whichever node of `scene` it is shown. */
export function registerPaintStandIn(scene: object, within: Element, keep: KeepPaint): PaintStandIn {
  const entry: Entry = { scene, within, keep, shown: null };
  entries.add(entry);
  return {
    show(id) {
      if (entry.shown === id || !entries.has(entry)) return;
      entry.shown = id;
      changed();
    },
    dispose() {
      if (entries.delete(entry) && entry.shown !== null) changed();
    },
  };
}

/** The stand-ins over a canvas of `scene` at `el`, by the node each shows. */
export function paintStandInsOver(el: Element, scene: object): ReadonlyMap<string, KeepPaint> {
  const out = new Map<string, KeepPaint>();
  for (const e of entries) if (e.shown !== null && e.scene === scene && e.within.contains(el)) out.set(e.shown, e.keep);
  return out;
}

const subscribe = (listener: () => void): (() => void) => changes.subscribe(listener);
const snapshot = (): number => version;

type EditingDrawOne = <TNode extends Node<unknown, string, unknown>>(
  node: TNode, pose: unknown, view?: View, ctx?: NodePaintCtx,
) => DrawCommand[];

/**
 * `layers` with the scene slot's `drawOne` passing each node a stand-in over the canvas at `elementRef` shows
 * through that stand-in's `keep`; `layers` itself while none does, or when the slot is not the kit's.
 */
export function useStandInLayers<TData, TLayer extends string, TPose>(
  scene: object,
  elementRef: MutableRefObject<HTMLElement | null>,
  layers: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined,
): SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined {
  const at = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => {
    const el = elementRef.current;
    const standIns = el ? paintStandInsOver(el, scene) : new Map<string, KeepPaint>();
    return layersStandingIn(layers, standIns);
    // `at` is the registry's version: a stand-in shown or hidden is a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, scene, elementRef, at]);
}

/** `layers` with each node `standIns` names painted through its `keep`. */
export function layersStandingIn<TData, TLayer extends string, TPose>(
  layers: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined,
  standIns: ReadonlyMap<string, KeepPaint>,
): SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined {
  if (standIns.size === 0) return layers;
  const slot = layers?.scene;
  if (slot === null || isCustomEntry(slot)) return layers;
  const base = (slot?.drawOne ?? defaultDrawOne) as EditingDrawOne;
  const paintBounds = slot && 'paintBounds' in slot
    ? slot.paintBounds
    : slot?.drawOne ? paintBoundsFor(base) : defaultPaintBounds;
  const drawOne: EditingDrawOne = (node, pose, view, ctx) => {
    const out = base(node, pose, view, ctx);
    const keep = standIns.get(node.id);
    return keep ? keep(out) : out;
  };
  return {
    ...layers, scene: { ...slot, drawOne, paintBounds },
  } as SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose>;
}
