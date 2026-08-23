import type { View } from 'core/viewport/view';

/**
 * @experimental
 *
 * A view the resolver can route input to: a camera and the rect it paints
 * into, in canvas CSS-pixel space. A viewport node supplies one of these per
 * frame; so could any other per-view surface.
 */
export interface ResolvableView {
  id: string;
  view: View;
  rect: { x: number; y: number; w: number; h: number };
}

/**
 * @experimental
 *
 * The view an input event belongs to. `id` is `null` for the root view —
 * the whole canvas, when no viewport contains the point.
 *
 * `origin` is the client-space origin of that view's surface, ready to hand
 * to `clientToWorld` — which is the whole reason this type carries it rather
 * than leaving callers to add the canvas rect and the view rect themselves.
 */
export interface ViewTarget {
  id: string | null;
  view: View;
  origin: { left: number; top: number };
}

/**
 * @experimental
 *
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

export interface CreateViewResolverOpts {
  /** Candidate views in paint order — the last one containing a point wins. */
  views: () => readonly ResolvableView[];
  /** The camera for points no view claims. */
  root: () => View;
  /** Client-space origin of the canvas element. */
  canvasOrigin: () => { left: number; top: number };
}

export function createViewResolver(opts: CreateViewResolverOpts): ViewResolver {
  const { views, root, canvasOrigin } = opts;
  const pinned = new Map<number, string | null>();

  function rootTarget(): ViewTarget {
    return { id: null, view: root(), origin: canvasOrigin() };
  }

  function target(v: ResolvableView): ViewTarget {
    const c = canvasOrigin();
    return {
      id: v.id,
      view: v.view,
      origin: { left: c.left + v.rect.x, top: c.top + v.rect.y },
    };
  }

  /** Right and bottom edges are exclusive, so neighbouring views never both
   *  claim a pixel — the same rule `ViewportLayer.reproject` follows. */
  function hit(clientX: number, clientY: number): ResolvableView | undefined {
    const c = canvasOrigin();
    const x = clientX - c.left;
    const y = clientY - c.top;
    const list = views();
    for (let i = list.length - 1; i >= 0; i--) {
      const { rect } = list[i]!;
      if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) return list[i];
    }
    return undefined;
  }

  function fresh(clientX: number, clientY: number): ViewTarget {
    const v = hit(clientX, clientY);
    return v ? target(v) : rootTarget();
  }

  return {
    begin(pointerId, clientX, clientY) {
      const t = fresh(clientX, clientY);
      pinned.set(pointerId, t.id);
      return t;
    },
    at(pointerId, clientX, clientY) {
      if (pointerId !== null && pinned.has(pointerId)) {
        const id = pinned.get(pointerId)!;
        if (id === null) return rootTarget();
        const v = views().find((c) => c.id === id);
        if (v) return target(v);
        pinned.delete(pointerId);
      }
      return fresh(clientX, clientY);
    },
    end(pointerId) {
      pinned.delete(pointerId);
    },
    clear() {
      pinned.clear();
    },
  };
}
