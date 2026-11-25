import { useCallback, useEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { clientScaleOf, clientToCanvasRect, layoutBoxOf } from '../../viewport/clientToCanvas';
import { openPointerSession, type PointerSession, type PointerSessionCancelReason } from '../pointerSession';
import { isPrimaryPress } from '@weasel-js/gestures';

/** A 2D point in the rect element's local coordinate space. */
export interface HandleDragPoint {
  x: number;
  y: number;
}

/** What a released drag reports. */
export interface HandleDragEnd {
  /** Where the pointer was let go, in the rect element's local space. */
  point: HandleDragPoint;
  /** False when the pointer never moved — a press, not a drag. Commit-on-end
   *  consumers use this to tell an edit from a stray click. */
  moved: boolean;
  event: PointerEvent;
}

/** Options for {@link useHandleDrag}. */
export interface UseHandleDragOptions<T extends HTMLElement | SVGElement> {
  /** Called on every `pointermove` with coords local to the rect element (see `getRect`). */
  onMove: (p: HandleDragPoint, e: PointerEvent) => void;
  /** Called on `pointerdown` with the same local coords passed to `onMove`. */
  onStart?: (p: HandleDragPoint, e: React.PointerEvent<T>) => void;
  /** The pointer was released. Not called when the drag is cancelled — a
   *  cancelled gesture is not an edit, and conflating the two made every
   *  commit-on-end consumer sniff the event type to tell them apart. */
  onEnd?: (end: HandleDragEnd) => void;
  /** The drag ended without a release: the pointer was cancelled, capture was
   *  lost, or the component unmounted mid-gesture. */
  onCancel?: (reason: PointerSessionCancelReason) => void;
  /** Escape cancels the drag, reported as `onCancel('escape')`. Default `false`. */
  escape?: boolean;
  /**
   * Element whose `getBoundingClientRect()` defines the local coordinate
   * space. Defaults to the handle target's owning `<svg>` if it has one,
   * otherwise the target itself.
   */
  getRect?: (target: T) => Element;
}

/** Return shape of {@link useHandleDrag}. */
export interface UseHandleDragReturn<T extends HTMLElement | SVGElement> {
  onPointerDown: (e: React.PointerEvent<T>) => void;
}

interface Scroller {
  el: Element;
  /** Client pixels per CSS pixel of the scroller's content, per axis. */
  scale: { x: number; y: number };
}

/** Whether `style` makes its box the containing block of a fixed descendant. */
const holdsFixed = (style: CSSStyleDeclaration): boolean =>
  (style.transform !== '' && style.transform !== 'none') || (style.filter !== '' && style.filter !== 'none')
  || (style.perspective !== '' && style.perspective !== 'none') || /paint|layout|strict|content/.test(style.contain);

/** The ancestors whose scrolling moves `el` on screen: none between a fixed box and its containing block, nor the
 *  one a sticky box sticks in. */
function scrollersOf(el: Element): Scroller[] {
  const view = el.ownerDocument.defaultView;
  const out: Scroller[] = [];
  let fixed = false;
  let sticky = false;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const style = view?.getComputedStyle(n);
    if (fixed && style && holdsFixed(style)) fixed = false;
    if (style?.position === 'fixed') fixed = true;
    else if (style?.position === 'sticky') sticky = true;
    const p = n.parentElement;
    if (!p || fixed) continue;
    if (sticky && (p === p.ownerDocument.documentElement || view?.getComputedStyle(p).overflow !== 'visible')) {
      sticky = false;
      continue;
    }
    out.push({ el: p, scale: p instanceof HTMLElement ? clientScaleOf(p) : { x: 1, y: 1 } });
  }
  return out;
}

/** How far `scrollers` have moved what they hold, in client pixels. */
function scrollOf(scrollers: readonly Scroller[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const { el, scale } of scrollers) {
    x += el.scrollLeft * scale.x;
    y += el.scrollTop * scale.y;
  }
  return { x, y };
}

function defaultRectEl(target: HTMLElement | SVGElement): Element {
  if (target instanceof SVGElement && target.ownerSVGElement) {
    return target.ownerSVGElement;
  }
  return target;
}

/**
 * Pointer drag for SVG/HTML handles. On `pointerdown` opens a
 * {@link openPointerSession | pointer session} on the handle, then forwards
 * every move to `onMove` with coordinates local to the rect-providing element
 * (defaulting to the handle's owning `<svg>`).
 *
 * The rect is measured once, at the press: a handle that moves under its own
 * drag must not shift the space its coordinates are reported in. A scroll
 * during the drag still moves it, by what the ancestors that carry it scrolled.
 */
export function useHandleDrag<T extends HTMLElement | SVGElement>(
  opts: UseHandleDragOptions<T>,
): UseHandleDragReturn<T> {
  // A drag outlives the render that saw its press, and its callbacks have to
  // be the current ones: `onEnd` commonly closes over state `onMove` set.
  const optsRef = useLatest(opts);
  const live = useRef<PointerSession | null>(null);

  useEffect(() => () => { live.current?.cancel(); }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<T>) => {
      // A right press is the context menu's, and a second button or finger mid-drag is not a new drag.
      if (!isPrimaryPress(e) || live.current?.active) return;
      e.preventDefault();

      const target = e.currentTarget;
      const { getRect, onStart } = optsRef.current;
      const rectEl = getRect ? getRect(target) : defaultRectEl(target);
      // Measured once: by default the box is the handle's own, which the drag moves.
      const box = layoutBoxOf(rectEl);
      const scrollers = scrollersOf(rectEl);
      const scrolled = scrollOf(scrollers);
      const localOf = (clientX: number, clientY: number): HandleDragPoint => {
        const now = scrollOf(scrollers);
        const at = { ...box, left: box.left - (now.x - scrolled.x), top: box.top - (now.y - scrolled.y) };
        const [x, y] = clientToCanvasRect(at, clientX, clientY);
        return { x, y };
      };

      let moved = false;
      const { clientX: pressX, clientY: pressY } = e;
      live.current = openPointerSession(target, e, {
        onMove: (ev) => {
          if (ev.clientX !== pressX || ev.clientY !== pressY) moved = true;
          optsRef.current.onMove(localOf(ev.clientX, ev.clientY), ev);
        },
        onEnd: (ev) => {
          live.current = null;
          optsRef.current.onEnd?.({ point: localOf(ev.clientX, ev.clientY), moved, event: ev });
        },
        onCancel: (reason) => {
          live.current = null;
          optsRef.current.onCancel?.(reason);
        },
      }, { escape: optsRef.current.escape === true });

      onStart?.(localOf(e.clientX, e.clientY), e);
    },
    [optsRef],
  );

  return { onPointerDown };
}
