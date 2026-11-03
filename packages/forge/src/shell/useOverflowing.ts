import { useLayoutEffect, useState } from 'react';

const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;

/** Whether `el` currently has more content than it shows, rechecked as it or any child resizes. */
export function useOverflowing(el: HTMLElement | null): boolean {
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setOverflowing(overflows(el));
    const sizes = new ResizeObserver(check);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(el);
      for (const child of el.children) sizes.observe(child, { box: 'border-box' });
    };
    const children = new MutationObserver(() => {
      watch();
      check();
    });
    children.observe(el, { childList: true });
    watch();
    check();
    return () => {
      children.disconnect();
      sizes.disconnect();
    };
  }, [el]);
  return overflowing;
}
