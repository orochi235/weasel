import type { View } from '@weasel-js/core';
import { useEffect, useLayoutEffect, useState } from 'react';
import type { Rect } from '../surface/rect';
import type { useSurfaceOptional } from '../surface/useSurfaceTile';
import type { AnnotationTarget } from './types';
import { fitView, toWeaselView } from './view';

/** Where a target is on the surface, and the part of that which shows. */
export interface Placement {
  rect: Rect;
  visible: Rect;
}

const sameRect = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const samePlacement = (a: Placement | null, b: Placement): boolean =>
  a !== null && sameRect(a.rect, b.rect) && sameRect(a.visible, b.visible);

/** The whole target's camera, shifted so the canvas starts at the part that shows. */
function cameraFor(target: AnnotationTarget, { rect, visible }: Placement): View {
  const whole = target.view ?? fitView(target.content, rect, target.shown);
  return toWeaselView({
    zoom: whole.zoom,
    pan: { x: whole.pan.x - (visible.x - rect.x), y: whole.pan.y - (visible.y - rect.y) },
  });
}

/** Where tile `tileId` sits each surface frame, kept as state so the pane renders at it. */
export function useOverlayPlacement(
  surface: ReturnType<typeof useSurfaceOptional>,
  tileId: string,
  redraw: () => void,
): Placement | null {
  const [placement, setPlacement] = useState<Placement | null>(null);
  useEffect(
    () =>
      surface?.registerPainter(tileId, (rect, frame) => {
        const next: Placement = { rect, visible: frame.visible.get(tileId) ?? rect };
        setPlacement((prev) => (samePlacement(prev, next) ? prev : next));
        // After the surface commits the placement: the renderer reads its
        // position from the last render, so a redraw landing first repaints the
        // tile where it was — after this frame's clear, which leaves a ghost.
        // The shared buffer was cleared if it resized this frame; this pane's
        // own loop has no way to know that.
        return redraw;
      }),
    [surface, tileId, redraw],
  );
  return placement;
}

/** The pane's camera at `placement`, repainting when it moves under a still
 *  tile (a scroll), which gets no surface frame of its own. */
export function useOverlayView(
  target: AnnotationTarget,
  placement: Placement | null,
  redraw: () => void,
): View | null {
  const view = placement ? cameraFor(target, placement) : null;
  const viewKey = view ? `${view.x},${view.y},${view.scale.x},${view.scale.y}` : '';
  useLayoutEffect(() => {
    if (viewKey) redraw();
  }, [viewKey, redraw]);
  return view;
}
