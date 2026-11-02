import { useCallback, useEffect, useRef } from 'react';
import { useLatest, useVisibleRaf } from '@weasel-js/react';
import type { Dispatcher } from '@weasel-js/routing';
import type { HeldPointerFeed } from '@weasel-js/routing/react';
import { unionAABB } from 'core/geometry/unionBounds';
import { clampView } from 'core/viewport/clampView';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
import { shownRect } from './sceneViewBounds';

/** `<SceneCanvas viewport={{ edgePan }}>`: how a drag near the edge scrolls the view. */
export interface EdgePanOptions {
  /** How far in from the canvas's edge the pointer starts the scroll, in screen pixels. Default 32. */
  zone?: number;
  /** The scroll's speed with the pointer at or past the edge, in screen pixels a second. It
   *  rises from nothing at the zone's inner side. Default 900. */
  speed?: number;
  /**
   * How far a drag that scrolls the view may reach: the world rect its
   * pointer is held inside, so what it drags stops there and the scroll
   * stops with it. A rect is fixed; `{ past }` is that many world units past
   * the content as it stood when the drag began. Omitted, a drag goes
   * wherever the pointer takes it.
   */
  limit?: Bounds | { past: number };
}

const DEFAULT_ZONE = 32;
const DEFAULT_SPEED = 900;
/** A frame longer than this, a stall, scrolls as far as this would. */
const MAX_FRAME_MS = 50;

/** What {@link useEdgePan} hands the gesture dispatcher. */
export interface EdgePan {
  /** The `heldPointer` callback for `useGestureDispatcher`. */
  heldPointer: (feed: HeldPointerFeed | null) => void;
  /** `world` held inside the limit while a drag that scrolls is in flight. */
  clampWorld: (world: { x: number; y: number }) => { x: number; y: number };
}

/**
 * Scrolls the view while a drag whose handle sets `autoPan` holds the pointer
 * in `zone` pixels of the canvas's edge or past it, faster the deeper it is,
 * and sends the held pointer's move again each frame so the drag reaches the
 * world the view now shows. Does nothing while the canvas has no size.
 */
export function useEdgePan(opts: {
  options: EdgePanOptions | false;
  dispatcher: Dispatcher;
  element: () => HTMLElement | null;
  getView: () => View;
  setView: (next: View) => void;
  /** The content's world rect, which `limit: { past }` measures from. */
  content: () => Bounds | null;
}): EdgePan {
  const live = useLatest(opts);
  const feedRef = useRef<HeldPointerFeed | null>(null);
  const lastFrame = useRef<number | null>(null);
  /** This drag's limit, fixed when it began; `undefined` between drags. */
  const dragLimit = useRef<Bounds | null | undefined>(undefined);

  const limit = useCallback((): Bounds | null => {
    const { options, dispatcher, content } = live.current;
    if (options === false || !options.limit || !autoPanning(dispatcher)) {
      dragLimit.current = undefined;
      return null;
    }
    if (dragLimit.current === undefined) dragLimit.current = limitRect(options.limit, content());
    return dragLimit.current;
  }, [live]);

  /** The scroll the pointer asks for now, in screen pixels a second; `null` for none. */
  const velocity = useCallback((): { x: number; y: number; dims: { width: number; height: number } } | null => {
    const { options, dispatcher, element } = live.current;
    if (options === false) return null;
    const at = feedRef.current?.at();
    const el = element();
    if (!at || !el || !autoPanning(dispatcher)) return null;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const zone = options.zone ?? DEFAULT_ZONE;
    const speed = options.speed ?? DEFAULT_SPEED;
    const pull = (inside: number) => speed * Math.min(1, Math.max(0, (zone - inside) / zone));
    const x = pull(r.right - at.clientX) - pull(at.clientX - r.left);
    const y = pull(r.bottom - at.clientY) - pull(at.clientY - r.top);
    return x === 0 && y === 0 ? null : { x, y, dims: { width: r.width, height: r.height } };
  }, [live]);

  const loop = useVisibleRaf((time, self) => {
    const v = velocity();
    const before = lastFrame.current;
    lastFrame.current = v ? time : null;
    if (!v) return;
    if (before !== null) {
      const dt = Math.min(time - before, MAX_FRAME_MS) / 1000;
      const view = live.current.getView();
      const next = { ...view, x: view.x + (v.x * dt) / view.scale.x, y: view.y + (v.y * dt) / view.scale.y };
      const reach = limit();
      // The limit stops the scroll too, but never pulls a view already past it back.
      live.current.setView(reach ? clampView(next, unionAABB([reach, shownRect(view, v.dims)])!, v.dims) : next);
      // A controlled camera takes the view a render later, so this move can
      // trail the scroll by a frame; the next one catches it up.
      feedRef.current?.repeat();
    }
    self.request();
  }, { target: () => live.current.element(), onResume: () => { lastFrame.current = null; } });

  const { dispatcher } = opts;
  useEffect(() => dispatcher.subscribe(() => {
    limit();
    if (velocity()) loop.request();
  }), [dispatcher, limit, velocity, loop]);

  const heldPointer = useCallback((feed: HeldPointerFeed | null) => {
    feedRef.current = feed;
    if (!feed) {
      loop.cancel();
      lastFrame.current = null;
    }
  }, [loop]);
  const clampWorld = useCallback((world: { x: number; y: number }) => {
    const reach = limit();
    if (!reach) return world;
    return {
      x: Math.min(Math.max(world.x, reach.x), reach.x + reach.width),
      y: Math.min(Math.max(world.y, reach.y), reach.y + reach.height),
    };
  }, [limit]);
  return { heldPointer, clampWorld };
}

function autoPanning(dispatcher: Dispatcher): boolean {
  for (const handle of dispatcher.getInFlightHandles()) if (handle.autoPan) return true;
  return false;
}

/** The world rect `limit` names, measured from `content` for `{ past }`; `null` for no content to measure from. */
export function limitRect(limit: Bounds | { past: number }, content: Bounds | null): Bounds | null {
  if (!('past' in limit)) return limit;
  if (!content) return null;
  const d = limit.past;
  return { x: content.x - d, y: content.y - d, width: content.width + 2 * d, height: content.height + 2 * d };
}
