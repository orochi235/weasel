import type { View } from 'core/viewport/view';
import { viewScreenToWorld } from '@weasel-js/geom';

/**
 * A view the resolver can route input to: a camera and the rect it paints
 * into, in canvas CSS-pixel space. A viewport node supplies one of these per
 * frame; so could any other per-view surface.
 */
export interface ResolvableView {
  id: string;
  view: View;
  rect: { x: number; y: number; w: number; h: number };
  /** The part of `rect` the view is seen through, in the same space — a view
   *  nested in another is cut to it. Omitted, the whole rect. */
  clip?: { x: number; y: number; w: number; h: number };
}

type Rect = { x: number; y: number; w: number; h: number };

/** Right and bottom edges are exclusive, so neighbouring views never both
 *  claim a pixel. */
const inside = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Whether `v` takes a canvas-local point: inside its rect and its clip. */
export function viewContains(v: ResolvableView, x: number, y: number): boolean {
  return inside(v.rect, x, y) && (v.clip === undefined || inside(v.clip, x, y));
}

/**
 * The view an input event belongs to. `id` is `null` for the root view —
 * the whole canvas, when no viewport contains the point.
 */
export interface ViewTarget {
  id: string | null;
  view: View;
  /** The point asked about, in that view's world. */
  world: { x: number; y: number };
}

/**
 * Routes client points to views, and holds a captured pointer on the view its
 * gesture started in.
 *
 * Stickiness is the point. A drag that leaves its view's rect — over a
 * neighbouring view, or off the canvas — must keep reporting coordinates in
 * the space it began in, or a marquee crossing a panel edge silently starts
 * measuring against the wrong camera.
 */
export interface ViewResolver {
  /** Resolve and pin `pointerId`. Call on pointerdown. */
  begin(pointerId: number, clientX: number, clientY: number): ViewTarget;
  /**
   * The view for a point. A pinned `pointerId` gets its pinned view, looked
   * up fresh so a rect that moved mid-gesture is honored. Pass `null` for
   * input with no pointer to capture — wheel, hover, keys.
   */
  at(pointerId: number | null, clientX: number, clientY: number): ViewTarget;
  /** Release `pointerId`. Call on pointerup and pointercancel. */
  end(pointerId: number): void;
  /** Release every pin. */
  clear(): void;
}

/**
 * Options for `createViewResolver`. Each field is a function called afresh on
 * every query, so views and the canvas may move between events.
 */
export interface CreateViewResolverOpts {
  /** Candidate views in paint order — the last one containing a point wins,
   *  so a nested view listed after the one around it is the one a point
   *  inside both reaches. */
  views: () => readonly ResolvableView[];
  /** The camera for points no view claims. */
  root: () => View;
  /** A client point in the canvas's own CSS pixels, from its top-left. */
  toLocal: (clientX: number, clientY: number) => { x: number; y: number };
  /**
   * Whether something painted over every view claims a canvas-local point —
   * chrome on the surface's own frame. Such a point resolves to the root even
   * inside a view's rect. Asked only where a view would otherwise win.
   */
  occluded?: (x: number, y: number) => boolean;
}

/** Build a `ViewResolver` over `opts.views`, falling back to `opts.root`. */
export function createViewResolver(opts: CreateViewResolverOpts): ViewResolver {
  const { views, root, toLocal, occluded } = opts;
  const pinned = new Map<number, string | null>();

  type Local = { x: number; y: number };
  /** `at`, a canvas point `from` its surface's top-left, through `view`. */
  const worldOf = (at: Local, from: Local, view: View): Local =>
    viewScreenToWorld(view, { x: at.x - from.x, y: at.y - from.y });

  function rootTarget(at: Local): ViewTarget {
    const view = root();
    return { id: null, view, world: worldOf(at, { x: 0, y: 0 }, view) };
  }

  function target(v: ResolvableView, at: Local): ViewTarget {
    return { id: v.id, view: v.view, world: worldOf(at, v.rect, v.view) };
  }

  function hit({ x, y }: Local): ResolvableView | undefined {
    const list = views();
    for (let i = list.length - 1; i >= 0; i--) {
      if (viewContains(list[i]!, x, y)) {
        return occluded?.(x, y) ? undefined : list[i];
      }
    }
    return undefined;
  }

  function fresh(at: Local): ViewTarget {
    const v = hit(at);
    return v ? target(v, at) : rootTarget(at);
  }

  return {
    begin(pointerId, clientX, clientY) {
      const t = fresh(toLocal(clientX, clientY));
      pinned.set(pointerId, t.id);
      return t;
    },
    at(pointerId, clientX, clientY) {
      const at = toLocal(clientX, clientY);
      if (pointerId !== null && pinned.has(pointerId)) {
        const id = pinned.get(pointerId)!;
        if (id === null) return rootTarget(at);
        const v = views().find((c) => c.id === id);
        if (v) return target(v, at);
        pinned.delete(pointerId);
      }
      return fresh(at);
    },
    end(pointerId) {
      pinned.delete(pointerId);
    },
    clear() {
      pinned.clear();
    },
  };
}
