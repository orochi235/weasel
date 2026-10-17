import { useEffect, useMemo, useRef, type FocusEvent } from 'react';

/**
 * Where focus goes as a menu bar is entered and left. What had focus before the bar is remembered when a title
 * takes focus from outside or a menu opens with focus outside, and is given back when the bar is left: on Escape
 * from a title with no menu open, and when a menu closes any way but Escape, which lands on its title instead.
 */
export function useMenuBarFocus(bar: { readonly current: HTMLElement | null }) {
  const returnTo = useRef<HTMLElement | null>(null);
  // Whether the key or press now being handled is an Escape; read when a menu closes.
  const escaped = useRef(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { escaped.current = e.key === 'Escape'; };
    const press = () => { escaped.current = false; };
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', press, true);
    window.addEventListener('pointerup', press, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', press, true);
      window.removeEventListener('pointerup', press, true);
    };
  }, []);

  // Reads only refs, so it is built once and its functions are stable.
  return useMemo(() => focusMoves(bar, returnTo, escaped), [bar]);
}

function focusMoves(
  bar: { readonly current: HTMLElement | null },
  returnTo: { current: HTMLElement | null },
  escaped: { readonly current: boolean },
) {
  const outside = (el: Element) => !bar.current?.contains(el) && !el.closest('[role="menu"]');
  const remember = (el: Element | null) => {
    returnTo.current = el instanceof HTMLElement && el !== document.body ? el : null;
  };

  const leave = (from: HTMLElement | null) => {
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) back.focus();
    else from?.blur();
  };

  return {
    /** Goes on the menubar element: a title taking focus from outside the bar and its menus. */
    onFocus: (e: FocusEvent) => {
      const from = e.relatedTarget;
      if (from instanceof Element && !outside(from)) return;
      remember(from instanceof Element ? from : null);
    },
    /** A menu is opening, and will take focus. */
    opening: () => {
      const el = document.activeElement;
      if (!el || outside(el)) remember(el);
    },
    leave,
    /** A menu has closed: if focus was in it, Escape puts it on the title and anything else leaves the bar. */
    closed: (title: HTMLElement | undefined) => {
      const el = document.activeElement;
      if (!el?.closest('[role="menu"]')) return;
      if (escaped.current) title?.focus();
      else leave(el instanceof HTMLElement ? el : null);
    },
  };
}
