import { adjacentPage, type PlacedPage } from 'core/pages/pages';
import { fitViewToPage, pageInView } from 'core/pages/fitViewToPage';
import type { FitViewToBoundsOptions, ViewportDims } from 'core/viewport/fitViewToBounds';
import type { ViewAnimationOptions } from 'core/viewport/useViewAnimation';
import type { View } from 'core/viewport/view';
import type { ViewApi } from 'interactions/actions/depSchema';

/**
 * Where a step goes: `by` places along the page order from the page in view
 * (`1` is the next slide), `to` a page by its id, its index, or an end.
 */
export type PageRequest =
  | { readonly by: number }
  | { readonly to: string | number | 'first' | 'last' };

/** What a presentation moves: the view, read and written, and the size it is seen at. */
export interface PresentationCamera {
  get(): View;
  /** The viewport in CSS px; `null` before it can be measured. */
  dims(): ViewportDims | null;
  /** Show `to`, gliding there when `animate` is given and the camera can glide. */
  show(to: View, animate: ViewAnimationOptions | null): void;
  /** Where a glide in flight is heading, so a second press steps on from there. */
  target?(): View | null;
}

/** How a presentation fits a page and moves between them. */
export interface PresentationStepOptions {
  /** Step past the last page to the first, and back. Default `false`. */
  wrap?: boolean;
  /** Glide between pages: `true` with the kit's timing, an object to tune it, `false` to cut. Default `true`. */
  animate?: boolean | ViewAnimationOptions;
  /** How a page fills the viewport, as `fitViewToBounds` takes it: `padding`, `mode`, the scale clamp. */
  fit?: FitViewToBoundsOptions;
}

/** The page `request` names, `null` when it names none or there are no pages. */
export function requestedPage(
  pages: readonly PlacedPage[],
  current: PlacedPage | null,
  request: PageRequest,
  wrap = false,
): PlacedPage | null {
  if ('by' in request) return adjacentPage(pages, current?.id ?? null, request.by, { wrap });
  const { to } = request;
  if (to === 'first') return pages[0] ?? null;
  if (to === 'last') return pages.at(-1) ?? null;
  if (typeof to === 'number') return pages[to] ?? null;
  return pages.find((p) => p.id === to) ?? null;
}

/** The page the camera shows, or is gliding to: the one most of its view covers. */
export function pageShown(pages: readonly PlacedPage[], camera: PresentationCamera): PlacedPage | null {
  const dims = camera.dims();
  if (dims === null) return null;
  return pageInView(pages, camera.target?.() ?? camera.get(), dims);
}

/**
 * Move `camera` to the page `request` names, fitted whole, and return that
 * page; `null`, and nothing moves, when there is no such page or the viewport
 * cannot be measured.
 */
export function stepPresentation(
  camera: PresentationCamera,
  pages: readonly PlacedPage[],
  request: PageRequest,
  options: PresentationStepOptions = {},
): PlacedPage | null {
  const dims = camera.dims();
  if (dims === null) return null;
  const page = requestedPage(pages, pageShown(pages, camera), request, options.wrap);
  if (page === null) return null;
  const view = fitViewToPage(page, dims, camera.get(), options.fit);
  if (view === null) return null;
  const { animate = true } = options;
  camera.show(view, animate === false ? null : animate === true ? {} : animate);
  return page;
}

/** `size` as viewport dims, `null` with no area: an unmounted or unlaid-out canvas measures zero. */
function measured(size: { width: number; height: number } | null): ViewportDims | null {
  return size !== null && size.width > 0 && size.height > 0 ? { width: size.width, height: size.height } : null;
}

/** The `view` dep as a {@link PresentationCamera}: it glides where the dep implements `animate`. */
export function viewCamera(view: ViewApi): PresentationCamera {
  return {
    get: () => view.get(),
    dims: () => measured(view.hostSize?.() ?? null),
    show: (to, animate) => {
      if (animate !== null && view.animate) view.animate(to, animate);
      else view.set(to);
    },
    target: () => view.animationTarget?.() ?? null,
  };
}

/** What {@link canvasCamera} reads off a canvas handle; `SceneCanvasApi` has every member. */
export interface PresentationCanvas {
  getView(): View;
  getSurfaceRect(): { width: number; height: number };
  setView(next: View): void;
  animateView(to: View, opts?: ViewAnimationOptions): void;
  isViewAnimating(): boolean;
}

/** A `<SceneCanvas>` handle as a {@link PresentationCamera}, for a host stepping pages from outside the canvas:
 *  a presentation runtime seeking to a step. */
export function canvasCamera(canvas: PresentationCanvas): PresentationCamera {
  let heading: View | null = null;
  return {
    get: () => canvas.getView(),
    dims: () => measured(canvas.getSurfaceRect()),
    show: (to, animate) => {
      heading = animate === null ? null : to;
      if (animate === null) canvas.setView(to);
      else canvas.animateView(to, animate);
    },
    target: () => (heading !== null && canvas.isViewAnimating() ? heading : null),
  };
}
