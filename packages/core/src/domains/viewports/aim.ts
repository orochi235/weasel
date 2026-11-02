import { fitViewToBounds, type Bounds } from 'core/viewport/fitViewToBounds';
import type { Dims } from 'core/layers/render';
import { normalizeView, type View } from 'core/viewport/view';
import { ZOOM_FLOOR } from 'core/viewport/zoomBounds';
import { viewScreenToWorld, viewWorldToScreen } from '@weasel-js/geom';

/** A point in a view's world. A 2D world is the plane z = 0, so `z` is absent there. */
export interface AimPoint {
  x: number;
  y: number;
  z?: number;
}

/** A closed outline in a frame's CSS px, from the frame's top-left; at least 3 points. */
export type AimOutline = readonly { x: number; y: number }[];

/** A target view, as an aim is drawn into it: its world, and its frame. */
export interface AimSpace {
  /** The view whose frame this is; `null` for a surface's root view. */
  readonly viewId: string | null;
  /** `'2d'` for core's views; any other value is its owner's (kernel3d: `'3d'`). */
  readonly kind: string;
  readonly size: { width: number; height: number };
  /** World point to frame px; `null` where the point does not draw (behind a 3D camera). */
  project(p: AimPoint): { x: number; y: number } | null;
  /** Frame px to the world point under it; `null` where there is none (a 3D ray missing its plane). */
  unproject(px: { x: number; y: number }): AimPoint | null;
}

/** What a viewport shows, read in the world of the view it names. */
export interface ViewAim<TExtent = unknown> {
  readonly viewId: string | null;
  /** Discriminates `extent`: `'rect'` for core's 2D views. */
  readonly kind: string;
  /** Where the aim lies in its world, in its owner's own terms. */
  readonly extent: TExtent;
  /** The aim's outline in `space`'s frame, or `null` when it cannot be drawn there. */
  outlineIn(space: AimSpace): AimOutline | null;
  /** This aim moved so the world point under frame px `from` in `space` ends up under `to`; `null` when either misses. */
  pannedIn(space: AimSpace, from: { x: number; y: number }, to: { x: number; y: number }): ViewAim<TExtent> | null;
}

/** Core's 2D aim: a world rect a view shows. */
export type RectAim = ViewAim<Bounds> & { readonly kind: 'rect' };

/** The aim of view `viewId` (`null`: a surface's root) showing world rect `rect`. */
export function rectAim(viewId: string | null, rect: Bounds): RectAim {
  return {
    viewId,
    kind: 'rect',
    extent: rect,
    outlineIn(space) {
      const { x, y, width, height } = rect;
      const out: { x: number; y: number }[] = [];
      for (const corner of [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ]) {
        const p = space.project(corner);
        if (!p) return null;
        out.push(p);
      }
      return out;
    },
    pannedIn(space, from, to) {
      const a = space.unproject(from);
      const b = space.unproject(to);
      if (!a || !b) return null;
      return rectAim(viewId, { ...rect, x: rect.x + (b.x - a.x), y: rect.y + (b.y - a.y) });
    },
  };
}

/** Whether `aim` is core's 2D rect aim, so its `extent` is a world rect. */
export function isRectAim(aim: ViewAim): aim is RectAim {
  return aim.kind === 'rect';
}

/** A 2D view's frame: `view` is its camera and `size` its frame; frame px are measured from the frame's top-left. */
export function aimSpace2d(viewId: string | null, view: View, size: Dims): AimSpace {
  return {
    viewId,
    kind: '2d',
    size: { width: size.width, height: size.height },
    project: (p) => viewWorldToScreen(view, p),
    unproject: (px) => viewScreenToWorld(view, px),
  };
}

const UNUSED_CURRENT: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/**
 * The camera that shows `rect` in a frame of `size`: `'exact'` per axis (the inverse of `viewportWorldRect`),
 * `'contain'` uniform and centered. Not clamped to a zoom range, and finite for an empty rect or frame. Normalized.
 */
export function viewForAim(rect: Bounds, size: Dims, fit: 'exact' | 'contain'): View {
  if (!(rect.width > 0 && rect.height > 0 && size.width > 0 && size.height > 0)) {
    return normalizeView({ x: rect.x, y: rect.y, scale: { x: ZOOM_FLOOR, y: ZOOM_FLOOR } });
  }
  return normalizeView(fitViewToBounds(rect, size, UNUSED_CURRENT, {
    mode: fit === 'exact' ? 'stretch' : 'contain', padding: 0, minScale: 0, maxScale: Infinity,
  }));
}
