import { useLayoutEffect, useState } from 'react';
import { watchResize } from '@weasel-js/react';

const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;

/** Whether `el` currently has more content than it shows, rechecked as it or any child resizes. */
export function useOverflowing(el: HTMLElement | null): boolean {
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    if (!el) return;
    const check = () => setOverflowing(overflows(el));
    const unwatchOwn = watchResize(el, check);
    let unwatchChildren = watchResize(el.children, check, { box: 'border-box' });
    const children = new MutationObserver(() => {
      unwatchChildren();
      unwatchChildren = watchResize(el.children, check, { box: 'border-box' });
      check();
    });
    children.observe(el, { childList: true });
    check();
    return () => {
      children.disconnect();
      unwatchOwn();
      unwatchChildren();
    };
  }, [el]);
  return overflowing;
}
