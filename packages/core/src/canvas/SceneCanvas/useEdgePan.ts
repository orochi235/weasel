import { useEffect, useMemo, useState } from 'react';
import { useLatest, useVisibleRaf, type VisibleRaf } from '@weasel-js/react';
import type { Dispatcher } from '@weasel-js/routing';
import type { HeldPointerFeed } from '@weasel-js/routing/react';
import { unionAABB } from 'core/geometry/unionBounds';
import { clampView } from 'core/viewport/clampView';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
import { viewportWorldRect } from 'core/viewport/viewportWorldRect';

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

interface EdgePanInputs {
  options: EdgePanOptions | false;
  dispatcher: Dispatcher;
  element: () => HTMLElement | null;
  getView: () => View;
  setView: (next: View) => void;
  /** The content's world rect, which `limit: { past }` measures from. */
  content: () => Bounds | null;
}

/**
 * Scrolls the view while a drag whose handle sets `autoPan` holds the pointer
 * in `zone` pixels of the canvas's edge or past it, faster the deeper it is,
 * and sends the held pointer's move again each frame so the drag reaches the
 * world the view now shows. Does nothing while the canvas has no size.
 */
export function useEdgePan(opts: EdgePanInputs): EdgePan {
  const live = useLatest(opts);
  const [pan] = useState(() => edgePan(() => live.current));
  const loop = useVisibleRaf((time, self) => { pan.frame(time, self); }, {
    phase: 'update',
    target: () => live.current.element(), onResume: () => { pan.resume(); },
  });
  const { dispatcher } = opts;
  useEffect(() => dispatcher.subscribe(() => { pan.changed(loop); }), [dispatcher, pan, loop]);
  return useMemo(() => ({
    heldPointer: (feed: HeldPointerFeed | null) => { pan.hold(feed, loop); },
    clampWorld: pan.clampWorld,
  }), [pan, loop]);
}

/** Edge panning's state between frames, over the inputs `read` returns now. */
function edgePan(read: () => EdgePanInputs) {
  let feed: HeldPointerFeed | null = null;
  let lastFrame: number | null = null;
  /** This drag's limit, fixed when it began; `undefined` between drags. */
  let dragLimit: Bounds | null | undefined;

  const limit = (): Bounds | null => {
    const { options, dispatcher, content } = read();
    if (options === false || !options.limit || !autoPanning(dispatcher)) {
      dragLimit = undefined;
      return null;
    }
    if (dragLimit === undefined) dragLimit = limitRect(options.limit, content());
    return dragLimit;
  };

  /** The scroll the pointer asks for now, in screen pixels a second; `null` for none. */
  const velocity = (): { x: number; y: number; dims: { width: number; height: number } } | null => {
    const { options, dispatcher, element } = read();
    if (options === false) return null;
    const at = feed?.at();
    const el = element();
    if (!at || !el || !autoPanning(dispatcher)) return null;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const zone = options.zone ?? DEFAULT_ZONE;
    const speed = options.speed ?? DEFAULT_SPEED;
    const pull = (inside: number) => (zone > 0
      ? speed * Math.min(1, Math.max(0, (zone - inside) / zone))
      : inside < 0 ? speed : 0);
    const x = pull(r.right - at.clientX) - pull(at.clientX - r.left);
    const y = pull(r.bottom - at.clientY) - pull(at.clientY - r.top);
    return x === 0 && y === 0 ? null : { x, y, dims: { width: r.width, height: r.height } };
  };

  return {
    frame(time: number, loop: VisibleRaf): void {
      const v = velocity();
      const before = lastFrame;
      lastFrame = v ? time : null;
      if (!v) return;
      if (before !== null) {
        const dt = Math.min(time - before, MAX_FRAME_MS) / 1000;
        const { getView, setView } = read();
        const view = getView();
        const next = { ...view, x: view.x + (v.x * dt) / view.scale.x, y: view.y + (v.y * dt) / view.scale.y };
        const reach = limit();
        // The limit stops the scroll too, but never pulls a view already past it back.
        setView(reach ? clampView(next, unionAABB([reach, viewportWorldRect(view, v.dims)])!, v.dims) : next);
        // A controlled camera takes the view a render later, so this move can
        // trail the scroll by a frame; the next one catches it up.
        feed?.repeat();
      }
      loop.request();
    },
    resume(): void { lastFrame = null; },
    /** After any change to the dispatcher's in-flight state. */
    changed(loop: VisibleRaf): void {
      limit();
      if (velocity()) loop.request();
    },
    hold(next: HeldPointerFeed | null, loop: VisibleRaf): void {
      feed = next;
      if (next) return;
      loop.cancel();
      lastFrame = null;
    },
    clampWorld(world: { x: number; y: number }): { x: number; y: number } {
      const reach = limit();
      if (!reach) return world;
      return {
        x: Math.min(Math.max(world.x, reach.x), reach.x + reach.width),
        y: Math.min(Math.max(world.y, reach.y), reach.y + reach.height),
      };
    },
  };
}

function autoPanning(dispatcher: Dispatcher): boolean {
  for (const handle of dispatcher.inFlight().values()) if (handle.autoPan) return true;
  return false;
}

/** The world rect `limit` names, measured from `content` for `{ past }`; `null` for no content to measure from. */
export function limitRect(limit: Bounds | { past: number }, content: Bounds | null): Bounds | null {
  if (!('past' in limit)) return limit;
  if (!content) return null;
  const d = limit.past;
  return { x: content.x - d, y: content.y - d, width: content.width + 2 * d, height: content.height + 2 * d };
}
