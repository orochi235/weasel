import type { View } from '@weasel-js/core';
import { fromCameraView, toCameraView } from '../canvas/cameraView';
import type { ViewTransform } from '../instrument/types';

/** A target's world in CSS pixels: the box its fractions are fractions of. */
export interface ContentSize {
  w: number;
  h: number;
}

/** Part of a target's content box, in its units. */
export interface ContentWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A target's drawn box on the surface, in CSS pixels. */
export interface PaneSize {
  w: number;
  h: number;
}

/** labkit's camera in weasel's shape. labkit's pan is a screen translation,
 *  weasel's `x`/`y` the world point at the top-left corner. Zoom is uniform,
 *  so it lands on both scale axes. */
export function toWeaselView(v: ViewTransform): View {
  return toCameraView(v);
}

/** The inverse. A weasel view with unequal axis scales collapses to its x —
 *  labkit's camera has one zoom and cannot hold the other. */
export function fromWeaselView(v: View): ViewTransform {
  return fromCameraView(v);
}

/**
 * The camera a target with none of its own draws through: the part of its
 * content box its element shows — `shown`, or the whole box — scaled to fit
 * the box it is drawn in, with that part's corner at the origin.
 *
 * The spec calls the camera "a plain scale" at zoom 1; zoom 1 is only right
 * when the pane happens to be the content's size, and a mark drawn on a
 * scaled-down pane otherwise lands outside it.
 */
export function fitView(content: ContentSize, pane: PaneSize, shown?: ContentWindow): ViewTransform {
  const part = shown ?? { x: 0, y: 0, w: content.w, h: content.h };
  const fit = part.w > 0 && part.h > 0 ? Math.min(pane.w / part.w, pane.h / part.h) : 1;
  const zoom = Number.isFinite(fit) && fit > 0 ? fit : 1;
  return { zoom, pan: { x: -part.x * zoom || 0, y: -part.y * zoom || 0 } };
}
