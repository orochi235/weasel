import { useCallback, useEffect, useRef } from 'react';
import { useLatest, useVisibleRaf } from '@weasel-js/react';
import type { Dispatcher } from '@weasel-js/routing';
import type { HeldPointerFeed } from '@weasel-js/routing/react';
import type { View } from 'core/viewport/view';

/** `<SceneCanvas viewport={{ edgePan }}>`: how a drag near the edge scrolls the view. */
export interface EdgePanOptions {
  /** How far in from the canvas's edge the pointer starts the scroll, in screen pixels. Default 32. */
  zone?: number;
  /** The scroll's speed with the pointer at or past the edge, in screen pixels a second. It
   *  rises from nothing at the zone's inner side. Default 900. */
  speed?: number;
}

const DEFAULT_ZONE = 32;
const DEFAULT_SPEED = 900;
/** A frame longer than this, a stall, scrolls as far as this would. */
const MAX_FRAME_MS = 50;

/**
 * Scrolls the view while a drag whose handle sets `autoPan` holds the pointer
 * in `zone` pixels of the canvas's edge or past it, faster the deeper it is,
 * and sends the held pointer's move again each frame so the drag reaches the
 * world the view now shows. Returns the `heldPointer` callback for
 * `useGestureDispatcher`. Does nothing while the canvas has no size.
 */
export function useEdgePan(opts: {
  options: EdgePanOptions | false;
  dispatcher: Dispatcher;
  element: () => HTMLElement | null;
  getView: () => View;
  setView: (next: View) => void;
}): (feed: HeldPointerFeed | null) => void {
  const live = useLatest(opts);
  const feedRef = useRef<HeldPointerFeed | null>(null);
  const lastFrame = useRef<number | null>(null);

  /** The scroll the pointer asks for now, in screen pixels a second; `null` for none. */
  const velocity = useCallback((): { x: number; y: number } | null => {
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
    return x === 0 && y === 0 ? null : { x, y };
  }, [live]);

  const loop = useVisibleRaf((time, self) => {
    const v = velocity();
    const before = lastFrame.current;
    lastFrame.current = v ? time : null;
    if (!v) return;
    if (before !== null) {
      const dt = Math.min(time - before, MAX_FRAME_MS) / 1000;
      const view = live.current.getView();
      live.current.setView({
        ...view,
        x: view.x + (v.x * dt) / view.scale.x,
        y: view.y + (v.y * dt) / view.scale.y,
      });
      // A controlled camera takes the view a render later, so this move can
      // trail the scroll by a frame; the next one catches it up.
      feedRef.current?.repeat();
    }
    self.request();
  }, { target: () => live.current.element(), onResume: () => { lastFrame.current = null; } });

  const { dispatcher } = opts;
  useEffect(() => dispatcher.subscribe(() => {
    if (velocity()) loop.request();
  }), [dispatcher, velocity, loop]);

  return useCallback((feed: HeldPointerFeed | null) => {
    feedRef.current = feed;
    if (!feed) {
      loop.cancel();
      lastFrame.current = null;
    }
  }, [loop]);
}

function autoPanning(dispatcher: Dispatcher): boolean {
  for (const handle of dispatcher.getInFlightHandles()) if (handle.autoPan) return true;
  return false;
}
