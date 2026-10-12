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

/** Whether `el` is the containing block of its fixed-position descendants rather than the viewport. */
function containsFixed(el: Element): boolean {
  const cs = getComputedStyle(el);
  const set = (value: string | undefined) => value !== undefined && value !== '' && value !== 'none';
  return (
    set(cs.transform) ||
    set(cs.filter) ||
    set(cs.backdropFilter) ||
    set(cs.perspective) ||
    /paint|layout|strict|content/.test(cs.contain ?? '')
  );
}

/**
 * Where a `position: fixed` element following the pointer mounts: `host`, and
 * the client-space point its `left: 0; top: 0` lands on.
 */
export interface FixedSeat {
  host: HTMLElement;
  left: number;
  top: number;
}

/**
 * The seat for something drawn at a client-space point on behalf of `from`, a
 * drag ghost above all: the nearest portal host, so it resolves the theme
 * `from` is drawn in, or the body. Subtract `left` and `top` from the client
 * point to place it.
 */
export function fixedSeat(from: Element | null | undefined): FixedSeat {
  const host = nearestPortalHost(from) ?? document.body;
  if (host === document.body || !containsFixed(host)) return { host, left: 0, top: 0 };
  const rect = host.getBoundingClientRect();
  return { host, left: rect.left, top: rect.top };
}
