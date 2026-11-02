import type { Dims } from 'core/layers/render';
import { unionAABB } from 'core/geometry/unionBounds';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
import type { CameraProps, ViewBoundsOf } from '../useCanvasView';

/** How `viewBounds: 'content'` bounds the view. */
export interface ContentViewBounds {
  /** How far past the content the view may go, in screen pixels, so the same
   *  at every zoom. Default {@link DEFAULT_CONTENT_MARGIN}. */
  margin?: number;
  /** World rects that count as content too, drawn or not: a page the
   *  document is laid out on, so an empty one still bounds the view. */
  include?: readonly Bounds[];
}

/** How far past the content `viewBounds: 'content'` lets the view go, in screen pixels, unless told otherwise. */
export const DEFAULT_CONTENT_MARGIN = 200;

/** `<SceneCanvas>`'s camera props: `<Canvas>`'s, with `viewBounds` able to follow the content. */
export type SceneCameraProps = Omit<CameraProps, 'viewBounds'> & {
  /**
   * Where the view may go. A world rect fixes it. `'content'`, or `{ content }`
   * to set the margin, bounds it to the scene's content plus a margin: every
   * root it draws, and whatever a gesture in flight proposes, so dragging
   * content outward takes the bounds with it. A view never moves to obey
   * them: it may stay where it is, or move toward the content, but not move
   * further out. Nothing bounds an empty scene. Omit it to pan freely.
   */
  viewBounds?: Bounds | 'content' | { content: ContentViewBounds };
};

/** The bounds `prop` sets, as the camera reads them at each write. */
export function sceneViewBounds(
  prop: SceneCameraProps['viewBounds'],
  contentBounds: () => Bounds | null,
): Bounds | ViewBoundsOf | undefined {
  if (prop === undefined) return undefined;
  if (prop !== 'content' && !('content' in prop)) return prop;
  const opts = prop === 'content' ? {} : prop.content;
  const margin = opts.margin ?? DEFAULT_CONTENT_MARGIN;
  const include = opts.include ?? [];
  return (from, dims) => contentReach(unionAABB([contentBounds(), ...include]), margin, from, dims);
}

/**
 * The world rect a view moving from `from` may show: `content` grown by
 * `margin` screen pixels at `from`'s zoom, and what `from` already shows.
 * `null` for no content.
 */
export function contentReach(content: Bounds | null, margin: number, from: View, dims: Dims): Bounds | null {
  if (!content) return null;
  const mx = margin / Math.abs(from.scale.x);
  const my = margin / Math.abs(from.scale.y);
  const grown = { x: content.x - mx, y: content.y - my, width: content.width + 2 * mx, height: content.height + 2 * my };
  return unionAABB([grown, shownRect(from, dims)]);
}

/** The world rect `view` shows over `dims`, whichever way its axes run. */
export function shownRect(view: View, dims: Dims): Bounds {
  const w = dims.width / view.scale.x;
  const h = dims.height / view.scale.y;
  return { x: Math.min(view.x, view.x + w), y: Math.min(view.y, view.y + h), width: Math.abs(w), height: Math.abs(h) };
}
