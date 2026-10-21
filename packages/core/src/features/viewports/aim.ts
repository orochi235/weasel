import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { Dims } from 'core/layers/render';
import { normalizeView, type View } from 'core/viewport/view';
import { ZOOM_FLOOR } from 'core/viewport/zoomBounds';

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

export type RectAim = ViewAim<Bounds> & { readonly kind: 'rect' };

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

export function isRectAim(aim: ViewAim): aim is RectAim {
  return aim.kind === 'rect';
}

/** A 2D view's frame: `view` is its camera and `size` its frame; frame px are measured from the frame's top-left. */
export function aimSpace2d(viewId: string | null, view: View, size: Dims): AimSpace {
  return {
    viewId,
    kind: '2d',
    size: { width: size.width, height: size.height },
    project: (p) => ({ x: (p.x - view.x) * view.scale.x, y: (p.y - view.y) * view.scale.y }),
    unproject: (px) => ({ x: px.x / view.scale.x + view.x, y: px.y / view.scale.y + view.y }),
  };
}

function scaleFor(frame: number, extent: number): number {
  return extent > 0 && frame > 0 ? frame / extent : ZOOM_FLOOR;
}

/** The camera that shows `rect` in a frame of `size`: `'exact'` per axis (the inverse of `viewportWorldRect`), `'contain'` uniform and centered. Normalized. */
export function viewForAim(rect: Bounds, size: Dims, fit: 'exact' | 'contain'): View {
  const sx = scaleFor(size.width, rect.width);
  const sy = scaleFor(size.height, rect.height);
  if (fit === 'exact') return normalizeView({ x: rect.x, y: rect.y, scale: { x: sx, y: sy } });
  const s = Math.min(sx, sy);
  return normalizeView({
    x: rect.x + rect.width / 2 - size.width / s / 2,
    y: rect.y + rect.height / 2 - size.height / s / 2,
    scale: { x: s, y: s },
  });
}
