/**
 * How a `<CanvasView>` sits in the view it is nested in: the frame its
 * `bounds` and derived camera are measured against, and the layers it may
 * paint. Without a `parent` the frame is the surface's.
 */
import { useCallback, useRef, useState } from 'react';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { SelectionApi } from 'core/selection/useSelection';
import type { CanvasViewProps, ViewRect } from './canvasViewProps';
import { createSceneLayerGate, viewPaintedLayers } from './sceneLayerPaint';
import type { ViewRegistration, ViewRegistry } from './viewRegistry';

export const NO_RECT: ViewRect = { x: 0, y: 0, w: 0, h: 0 };

/** What a view's `bounds` and `view` are measured against: the surface, or
 *  the view it is nested in. `origin` and `clip` are in canvas CSS px. */
export interface OuterFrame { view: View; dims: Dims; origin: { x: number; y: number }; clip?: ViewRect }

/** The props the nesting reads, as of the last committed render. */
export type ViewNestingInputs = Pick<CanvasViewProps, 'parent' | 'follows' | 'bounds' | 'layers' | 'layerVisibility' | 'layerOrder'> & {
  /** The selection the view owns, when it owns one. */
  viewSelection?: SelectionApi | undefined;
  /** The surface's selection, which the view acts on while it neither owns one nor follows a view that does. */
  shared: SelectionApi;
};

/** A view rect's size, as the `Dims` its camera looks through. */
export const sizeOf = (rect: ViewRect): Dims => ({ width: rect.w, height: rect.h });

export function useViewNesting(
  registry: ViewRegistry | null,
  live: { readonly current: ViewNestingInputs },
) {
  // Set while this view asks its parent for a frame, so a parent chain that
  // loops back finds no frame rather than recursing.
  const measuring = useRef(false);
  /** The frame this view is measured in, for a surface frame; `null` while
   *  its parent is missing. */
  const frameIn = useCallback((outer: View, dims: Dims): OuterFrame | null => {
    const p = live.current.parent;
    if (p === undefined) return { view: outer, dims, origin: { x: 0, y: 0 } };
    const reg = registry?.get(p);
    if (!reg || measuring.current) return null;
    measuring.current = true;
    try {
      const r = reg.layer.resolvable(outer, dims);
      return {
        view: r.view, dims: sizeOf(r.rect), origin: { x: r.rect.x, y: r.rect.y }, clip: r.clip ?? r.rect,
      };
    } finally {
      measuring.current = false;
    }
  }, [live, registry]);

  const rectAt = useCallback((outer: View, dims: Dims): ViewRect => {
    const frame = frameIn(outer, dims);
    if (!frame) return NO_RECT;
    const b = live.current.bounds;
    const r = typeof b === 'function' ? b(frame.view, frame.dims) : b;
    return { ...r, x: r.x + frame.origin.x, y: r.y + frame.origin.y };
  }, [live, frameIn]);

  /** A derived camera or aim, for a surface frame: asked of the frame it is measured in. */
  const derivedAt = useCallback(<T>(derive: (outer: View, dims: Dims) => T, outer: View, dims: Dims): T => {
    const frame = frameIn(outer, dims);
    return frame ? derive(frame.view, frame.dims) : derive(outer, dims);
  }, [frameIn]);

  /** The view this one is nested in, while it is registered. */
  const parentReg = useCallback((): ViewRegistration | undefined => {
    const p = live.current.parent;
    return p === undefined ? undefined : registry?.get(p);
  }, [live, registry]);

  // Set while this view asks the view it follows, so two views following each
  // other find nothing to follow rather than recursing.
  const following = useRef(false);
  /** `read` asked of the view this one follows, while it names a live one. */
  const ofFollowed = useCallback(<T>(read: (reg: ViewRegistration) => T): { value: T } | null => {
    const id = live.current.follows?.() ?? null;
    const reg = id === null || following.current ? undefined : registry?.get(id);
    if (!reg) return null;
    following.current = true;
    try {
      return { value: read(reg) };
    } finally {
      following.current = false;
    }
  }, [live, registry]);

  /** The layers this view draws, in the order it draws them: of the surface's,
   *  or of what the view it is nested in or follows draws. */
  const drawnLayers = useCallback((): readonly RenderLayer<unknown>[] => {
    const followed = ofFollowed((reg) => reg.drawnLayers());
    if (followed) return viewPaintedLayers(followed.value, live.current);
    if (live.current.parent !== undefined) return viewPaintedLayers(parentReg()?.drawnLayers() ?? [], live.current);
    return viewPaintedLayers(registry?.surface()?.layers() ?? [], live.current);
  }, [registry, live, parentReg, ofFollowed]);

  const [sceneLayerGate] = useState(createSceneLayerGate);
  /** What this view's picks, marquees and select-alls ask of a scene layer:
   *  painted here, and in every view this one is nested in or follows. */
  const layerIsPainted = useCallback((layerId: string): boolean => {
    if (!sceneLayerGate(registry?.surface()?.layers() ?? [], live.current)(layerId)) return false;
    const followed = ofFollowed((reg) => reg.layerIsPainted(layerId));
    if (followed) return followed.value;
    if (live.current.parent === undefined) return true;
    return parentReg()?.layerIsPainted(layerId) ?? false;
  }, [registry, sceneLayerGate, live, parentReg, ofFollowed]);

  /** The selection this view owns, or else the one the view it follows owns:
   *  `undefined` while it shares the surface's. */
  const ownedSelection = useCallback((): SelectionApi | undefined => (
    live.current.viewSelection ?? ofFollowed((reg) => reg.selection())?.value
  ), [live, ofFollowed]);
  /** The selection this view acts on, as of now: a followed view's changes with the aim. */
  const selectionNow = useCallback(() => ownedSelection() ?? live.current.shared, [ownedSelection, live]);
  return { frameIn, rectAt, derivedAt, drawnLayers, layerIsPainted, ownedSelection, selectionNow };
}
