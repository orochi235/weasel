/**
 * DOM pinned to a diagram's nodes and edges: a settings card beside the picked
 * node, a button on an edge's midpoint. Each overlay is placed after every
 * paint, so it follows a pan, a zoom, a resize and a layout run's every frame.
 */
import {
  composeWorldPose,
  drawnAABBOf,
  drawnBoundsScene,
  effectivePose,
  pointAlongPath,
  scenePoseAdapter,
  type Bounds,
  type NodeId,
  type RectPose,
  type Scene,
  type SceneCanvasApi,
  viewRectToScreen,
} from '@weasel-js/core';
import { useLatest } from '@weasel-js/react';
import { clampRectWithin, placeRect, type Placement } from '@weasel-js/geom';
import { useCallback, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { diagramEdgeOf } from './edgeTrait';
import type { DiagramSceneData } from './fromData';

/** One piece of DOM held against a node, a group or an edge. */
export interface DiagramOverlay {
  /** The node, group or edge it is held against. While no such id is in the
   *  diagram it is not shown. */
  target: string;
  /** Beside the target's box, flipped to the far side when the near one has
   *  no room, and kept inside the view, over the target when neither side has
   *  room; or `'center'`, centered on it. Default `'center'`. */
  placement?: Placement | 'center';
  /** Gap between the target's box and the overlay, in CSS pixels. Default 0. */
  offset?: number;
  /** Tells two overlays on one target apart. Default `target`. */
  key?: string;
  content: ReactNode;
}

type DiagramScene = Scene<DiagramSceneData, 'main', RectPose>;

/** Where `id` is drawn, in world units: a node's or group's box, or for an
 *  edge an empty rect at the midpoint along its route. `null` when the scene
 *  has no such node. */
export function worldRectOf(scene: DiagramScene, id: string): Bounds | null {
  const node = scene.get(id as NodeId);
  if (node === undefined) return null;
  const drawn = drawnBoundsScene(scene);
  const route = diagramEdgeOf(node) === null ? null : drawn.derivedPathOf?.(id as NodeId) ?? null;
  const mid = route === null ? null : pointAlongPath(route, 0.5);
  if (mid != null) return { x: mid.point.x, y: mid.point.y, width: 0, height: 0 };
  const live = { ...scenePoseAdapter(scene as never), getPose: (at: string) => effectivePose(scene, scene.get(at as NodeId)!) };
  return drawnAABBOf(drawn, id as NodeId, composeWorldPose(live, id, scene.composition.compose as never), { includeStroke: false });
}

const CENTER = 'center';

/** Place `el` against `anchor` inside `view`. */
function place(el: HTMLElement, overlay: DiagramOverlay, anchor: Bounds, view: Bounds): void {
  const size = { width: el.offsetWidth, height: el.offsetHeight };
  const placement = overlay.placement ?? CENTER;
  const at = placement === CENTER
    ? { x: anchor.x + (anchor.width - size.width) / 2, y: anchor.y + (anchor.height - size.height) / 2 }
    // With no room on either side, placeRect leaves it overflowing; the view keeps it inside, over its target if it must.
    : clampRectWithin(placeRect({ anchor, overlay: size, boundary: view, placement, offset: overlay.offset ?? 0 }).rect, view);
  el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
}

/**
 * The overlays' elements, placed after every paint and whenever one of them
 * changes size. The returned ref function takes each overlay's element by key.
 */
export function useOverlayPlacement(
  canvasRef: RefObject<SceneCanvasApi | null>,
  scene: DiagramScene,
  overlays: readonly DiagramOverlay[],
): (key: string) => (el: HTMLElement | null) => void {
  const elements = useRef(new Map<string, HTMLElement>());
  const current = useLatest(overlays);

  const placeAll = useCallback(() => {
    const canvas = canvasRef.current;
    const surface = canvas?.element;
    if (canvas == null || surface == null) return;
    const view = canvas.getView();
    for (const overlay of current.current) {
      const el = elements.current.get(overlay.key ?? overlay.target);
      if (el === undefined) continue;
      const world = worldRectOf(scene, overlay.target);
      el.hidden = world === null;
      if (world === null) continue;
      const rect = viewRectToScreen(view, world);
      const anchor = { ...rect, x: rect.x + surface.offsetLeft, y: rect.y + surface.offsetTop };
      place(el, overlay, anchor, {
        x: surface.offsetLeft, y: surface.offsetTop, width: surface.offsetWidth, height: surface.offsetHeight,
      });
    }
  }, [canvasRef, scene, current]);

  useLayoutEffect(() => {
    placeAll();
    const canvas = canvasRef.current;
    if (canvas == null) return;
    const stop = canvas.subscribeFrame(placeAll);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(placeAll);
    for (const el of elements.current.values()) observer?.observe(el);
    return () => {
      stop();
      observer?.disconnect();
    };
  }, [canvasRef, placeAll, overlays]);

  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  return useCallback((key: string) => {
    let ref = refs.current.get(key);
    if (ref === undefined) {
      ref = (el) => {
        if (el !== null) {
          elements.current.set(key, el);
          return;
        }
        elements.current.delete(key);
        refs.current.delete(key);
      };
      refs.current.set(key, ref);
    }
    return ref;
  }, []);
}
