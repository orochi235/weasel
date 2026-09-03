import type { View } from '@weasel-js/core';
import type { ViewTransform } from '../instrument/types';

/** A target's world in CSS pixels: the box its fractions are fractions of. */
export interface ContentSize {
  w: number;
  h: number;
}

/** A target's drawn box on the surface, in CSS pixels. */
export interface PaneSize {
  w: number;
  h: number;
}

/** labkit's camera in weasel's shape. Zoom is uniform, so it lands on both
 *  scale axes; pan is weasel's translation unchanged. */
export function toWeaselView(v: ViewTransform): View {
  return { x: v.pan.x, y: v.pan.y, scale: { x: v.zoom, y: v.zoom } };
}

/** The inverse. A weasel view with unequal axis scales collapses to its x —
 *  labkit's camera has one zoom and cannot hold the other. */
export function fromWeaselView(v: View): ViewTransform {
  return { zoom: v.scale.x, pan: { x: v.x, y: v.y } };
}

/**
 * The camera a target with none of its own draws through: its content box
 * scaled to fit the box it is drawn in, anchored at the origin.
 *
 * The spec calls the camera "a plain scale" at zoom 1; zoom 1 is only right
 * when the pane happens to be the content's size, and a mark drawn on a
 * scaled-down pane otherwise lands outside it.
 */
export function fitView(content: ContentSize, pane: PaneSize): ViewTransform {
  const zoom =
    content.w > 0 && content.h > 0 ? Math.min(pane.w / content.w, pane.h / content.h) : 1;
  return { zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1, pan: { x: 0, y: 0 } };
}
