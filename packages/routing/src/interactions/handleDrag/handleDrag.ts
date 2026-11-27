import { useCallback, useEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { clientScaleOf, clientToCanvasRect, layoutBoxOf } from '../../viewport/clientToCanvas';
import { openPointerSession, type PointerSession, type PointerSessionCancelReason } from '../pointerSession';
import { flatParentOf } from '../elementAt';
import { isPrimaryPress } from '@weasel-js/gestures';
import { flatParentOf } from '../elementAt';

/** A 2D point in the rect element's local coordinate space. */
export interface HandleDragPoint {
  x: number;
  y: number;
}

/** What a released drag reports. */
export interface HandleDragEnd {
  /** Where the pointer was let go, in the rect element's local space. */
  point: HandleDragPoint;
  /** False when the point never left the press point in the rect's space — a press, not a drag. A scroll
   *  under a still pointer moves it. Commit-on-end consumers use this to tell an edit from a stray click. */
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
  /** How far, in client pixels, the scroller has moved what it holds back from where it would sit unscrolled. */
  moved: () => { x: number; y: number };
}

/** The properties any value but `none` of which makes a box the containing block of a fixed descendant. */
const FIXED_HOLDERS = ['transform', 'translate', 'rotate', 'scale', 'perspective', 'filter', 'backdrop-filter', 'offset-path'];

/** Of those, the ones that make no containing block on the root element (Filter Effects 1 and 2). */
const ROOT_EXEMPT = ['filter', 'backdrop-filter'];

/** `will-change` values that make a containing block for a fixed descendant, as the properties they name would. */
const WILL_CHANGE_HOLDERS = [...FIXED_HOLDERS, 'contain', 'transform-style'];

/** Whether `style` makes its box the containing block of a fixed descendant (and so of an absolute one). */
const holdsFixed = (style: CSSStyleDeclaration, root: boolean): boolean => {
  const exempt = (prop: string) => root && ROOT_EXEMPT.includes(prop);
  return FIXED_HOLDERS.some((prop) => !exempt(prop) && !['', 'none'].includes(style.getPropertyValue(prop)))
    || style.getPropertyValue('transform-style') === 'preserve-3d'
    || style.getPropertyValue('will-change').split(',').some((v) => !exempt(v.trim()) && WILL_CHANGE_HOLDERS.includes(v.trim()))
    || /paint|layout|strict|content/.test(style.getPropertyValue('contain'))
    || /size/.test(style.getPropertyValue('container-type'))
    || /auto|hidden/.test(style.getPropertyValue('content-visibility'));
};

/** Whether a box with `style` is the containing block of a descendant positioned as `position`. */
const holds = (position: string | undefined, style: CSSStyleDeclaration | undefined, root: boolean): boolean =>
  position === 'fixed' ? !!style && holdsFixed(style, root)
  : position === 'absolute' ? !!style && (style.position !== 'static' || holdsFixed(style, root))
  : true;

/** Whether a box with `style` is a scroll container, which `visible` and `clip` on both axes are not. */
const scrollsBox = (style: CSSStyleDeclaration | undefined): boolean =>
  !!style && ['overflow-x', 'overflow-y'].some((axis) => ['hidden', 'scroll', 'auto'].includes(style.getPropertyValue(axis)));

/** The ancestors whose scrolling moves `el` on screen: each box's containing block, up the chain, but not the
 *  viewport a fixed box is held by. */
function scrollersOf(el: Element): Scroller[] {
  const view = el.ownerDocument.defaultView;
  const root = el.ownerDocument.documentElement;
  const styleOf = (n: Element) => view?.getComputedStyle(n);
  const out: Scroller[] = [];
  let sticky: Element | null = null;
  for (let n: Element = el; ;) {
    const position = styleOf(n)?.position;
    if (position === 'sticky') sticky ??= n;
    let p = flatParentOf(n);
    while (p && !holds(position, styleOf(p), p === root)) p = flatParentOf(p);
    if (!p) {
      // An absolute box with no positioned ancestor is held by the initial containing block, which the page scrolls.
      if (position === 'absolute' && n !== root) out.push(scrollerOf(root));
      return out;
    }
    if (sticky && (p === root || scrollsBox(styleOf(p)))) {
      out.push(stickyScrollerOf(sticky, p, styleOf(sticky)));
      sticky = null;
    } else out.push(scrollerOf(p));
    n = p;
  }
}

/** A scroller that moves what it holds by its own scroll offset. The root's is the page's, which the document's
 *  scrolling element reports: in quirks mode that is the body, whose own box then scrolls nothing. */
function scrollerOf(el: Element): Scroller {
  const doc = el.ownerDocument;
  const page = doc.scrollingElement ?? doc.documentElement;
  if (el === page && el !== doc.documentElement) return { moved: () => ({ x: 0, y: 0 }) };
  const from = el === doc.documentElement ? page : el;
  const scale = clientScaleOf(el);
  return { moved: () => ({ x: from.scrollLeft * scale.x, y: from.scrollTop * scale.y }) };
}

/** The scroller `box`, positioned sticky, sticks in. On an axis with an inset the box rides the scroll only until it
 *  sticks, so there what it moved is the scroll less how far sticking pushed it back; on the others it rides it. */
function stickyScrollerOf(box: Element, scroller: Element, style: CSSStyleDeclaration | undefined): Scroller {
  const inset = (a: string, b: string) => !!style && [a, b].some((side) => !['', 'auto'].includes(style.getPropertyValue(side)));
  const stuckX = inset('left', 'right');
  const stuckY = inset('top', 'bottom');
  const scroll = scrollerOf(scroller);
  const stuck = stuckOffsetOf(box, scroller);
  return {
    moved: () => {
      const s = scroll.moved();
      if (!stuckX && !stuckY) return s;
      const o = stuck(s);
      return { x: stuckX ? s.x - o.x : s.x, y: stuckY ? s.y - o.y : s.y };
    },
  };
}

/** How far sticking has pushed `box` along, in client px and up to a constant, given the scroll `s` it sticks in. An
 *  HTML box reads it off its offset, which its own transform leaves alone, since the box is often the handle the drag
 *  moves; another reads its rect against the scroller's. */
function stuckOffsetOf(box: Element, scroller: Element): (s: { x: number; y: number }) => { x: number; y: number } {
  const el = box as Partial<HTMLElement>;
  if (typeof el.offsetTop === 'number' && typeof el.offsetLeft === 'number') {
    const scale = clientScaleOf(box);
    return () => ({ x: el.offsetLeft! * scale.x, y: el.offsetTop! * scale.y });
  }
  // The root's own box scrolls with the page; a box stuck to the viewport sticks to the viewport's edge.
  const viewport = scroller === scroller.ownerDocument.documentElement;
  return (s) => {
    const b = box.getBoundingClientRect();
    const p = viewport ? { left: 0, top: 0 } : scroller.getBoundingClientRect();
    return { x: s.x + b.left - p.left, y: s.y + b.top - p.top };
  };
}

/** How far `scrollers` have moved what they hold, in client pixels. */
function scrollOf(scrollers: readonly Scroller[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const scroller of scrollers) {
    const m = scroller.moved();
    x += m.x;
    y += m.y;
  }
  return { x, y };
}

function defaultRectEl(target: HTMLElement | SVGElement): Element {
  return ('ownerSVGElement' in target ? target.ownerSVGElement : null) ?? target;
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
      const start = localOf(e.clientX, e.clientY);
      // Judged in the rect's space, where a scroll under a still pointer moves the point too.
      const away = (p: HandleDragPoint) => p.x !== start.x || p.y !== start.y;
      live.current = openPointerSession(target, e, {
        onMove: (ev) => {
          const point = localOf(ev.clientX, ev.clientY);
          if (away(point)) moved = true;
          optsRef.current.onMove(point, ev);
        },
        onEnd: (ev) => {
          live.current = null;
          const point = localOf(ev.clientX, ev.clientY);
          optsRef.current.onEnd?.({ point, moved: moved || away(point), event: ev });
        },
        onCancel: (reason) => {
          live.current = null;
          optsRef.current.onCancel?.(reason);
        },
      }, { escape: optsRef.current.escape === true });

      onStart?.(start, e);
    },
    [optsRef],
  );

  return { onPointerDown };
}
