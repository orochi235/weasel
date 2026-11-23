import { clientScaleOf } from './clientScale';

/**
 * Elements an overlay may portal into: anything a theme has been stamped on
 * (`applyTheme` / `<ThemeProvider>` write both attributes), plus anything
 * opting in with `data-wzl-portal-host`. The opt-in exists for a styling root
 * that sits *below* the themed element — labkit's `.lk-root` carries element
 * defaults the themed wrapper does not.
 */
const HOST_SELECTOR = '[data-wzl-portal-host],[data-wzl-theme],[data-wzl-mode]';

/**
 * The nearest element `from` sits inside that can host a portalled overlay,
 * or `null` when there is none and the body is the only answer.
 */
export function nearestPortalHost(from: Element | null | undefined): HTMLElement | null {
  return (from?.closest(HOST_SELECTOR) as HTMLElement | null) ?? null;
}

const set = (value: string | undefined) => value !== undefined && value !== '' && value !== 'none';
// Whole idents only: `transform-origin` and `contain-intrinsic-size` contain nothing.
const FIXED_CONTAINING_WILL_CHANGE = /(^|[\s,])(transform|translate|scale|rotate|perspective|transform-style|offset-path|contain)(?=$|[\s,])/;
const FILTER_WILL_CHANGE = /(^|[\s,])(filter|backdrop-filter)(?=$|[\s,])/;

/** Whether `el` is the containing block of its fixed-position descendants rather than the viewport. */
function containsFixed(el: Element): boolean {
  const cs = (el.ownerDocument.defaultView ?? window).getComputedStyle(el);
  // Filter Effects exempts the root: `html { filter: invert(1) }` leaves fixed boxes to the viewport.
  const root = el === el.ownerDocument.documentElement;
  const willChange = cs.willChange ?? '';
  return (
    set(cs.transform) ||
    set(cs.translate) ||
    set(cs.scale) ||
    set(cs.rotate) ||
    (!root && (set(cs.filter) || set(cs.backdropFilter) || FILTER_WILL_CHANGE.test(willChange))) ||
    set(cs.perspective) ||
    cs.transformStyle === 'preserve-3d' ||
    set(cs.offsetPath) ||
    /paint|layout|strict|content/.test(cs.contain ?? '') ||
    // `container-type` other than `normal` and `content-visibility: auto` both apply layout containment.
    (cs.containerType !== undefined && cs.containerType !== '' && cs.containerType !== 'normal') ||
    cs.contentVisibility === 'auto' ||
    FIXED_CONTAINING_WILL_CHANGE.test(willChange)
  );
}

/**
 * Where a `position: fixed` element following the pointer mounts: `host`, the
 * client-space point its `left: 0; top: 0` lands on, and the client px per CSS
 * px an ancestor transform draws it at.
 */
export interface FixedSeat {
  host: HTMLElement;
  left: number;
  top: number;
  scale: { x: number; y: number };
}

/**
 * The seat for something drawn at a client-space point on behalf of `from`, a
 * drag ghost above all: the nearest portal host, so it resolves the theme
 * `from` is drawn in, or the body. Subtract `left` and `top` from the client
 * point, and divide by `scale`, to place it.
 */
export function fixedSeat(from: Element | null | undefined): FixedSeat {
  const doc = from?.ownerDocument ?? document;
  const host = nearestPortalHost(from) ?? doc.body;
  // The containing block can be any ancestor of the host, not only the host.
  for (let el: Element | null = host; el !== null; el = el.parentElement) {
    if (!containsFixed(el)) continue;
    const rect = el.getBoundingClientRect();
    const scale = clientScaleOf(el, rect);
    // Fixed descendants are placed from the padding box, inside the border the rect includes.
    const box = el as Partial<Pick<HTMLElement, 'clientLeft' | 'clientTop'>>;
    // They scroll with a scrolling block's content. The root's rect already moves with the document's scroll.
    const scroll = el === doc.documentElement ? { scrollLeft: 0, scrollTop: 0 } : el;
    return {
      host,
      left: rect.left + ((box.clientLeft ?? 0) - scroll.scrollLeft) * scale.x,
      top: rect.top + ((box.clientTop ?? 0) - scroll.scrollTop) * scale.y,
      scale,
    };
  }
  return { host, left: 0, top: 0, scale: { x: 1, y: 1 } };
}
