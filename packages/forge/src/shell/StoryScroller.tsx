import { useTrialTitle } from '@weasel-js/labkit';
import { type ReactNode, useLayoutEffect, useState } from 'react';

const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;

/** Whether `el` currently has more content than it shows, rechecked as it or any child resizes. */
function useOverflowing(el: HTMLElement | null): boolean {
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

/**
 * The story's own box. While its story overflows it is a tab stop, so a keyboard can scroll it, and a region named
 * for the trial, as WCAG asks of a focusable scroller.
 */
export function StoryScroller({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const overflowing = useOverflowing(el);
  const title = useTrialTitle();
  return (
    <div
      ref={setEl}
      className="fg-story__scroll"
      {...(overflowing ? { tabIndex: 0, role: 'region', 'aria-label': title ?? 'Story' } : {})}
    >
      {children}
    </div>
  );
}
