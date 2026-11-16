import { useLayoutEffect, useState, type RefCallback, type RefObject } from 'react';
import { useReportDockLeast } from '../ToolbarDock/dockContext';
import { watchResize } from '@weasel-js/react';

/**
 * Tells the dock drawing a bar's menu button that the bar cannot be shorter than its lead and the whole button,
 * since a menu has nothing to give up as a squeezed row narrows it. Returns the ref the lead goes on, which may
 * mount or leave after the button does.
 */
export function useMenuLeast(button: RefObject<HTMLButtonElement | null>): RefCallback<HTMLSpanElement> {
  const [lead, setLead] = useState<HTMLSpanElement | null>(null);
  const [least, setLeast] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = button.current;
    if (el === null) return;
    const measure = (): void => {
      const start = (lead ?? el).getBoundingClientRect().left;
      const squeezed = el.scrollWidth - el.clientWidth;
      setLeast(Math.ceil(el.getBoundingClientRect().right - start + Math.max(0, squeezed)));
    };
    measure();
    return watchResize([el, lead], measure);
  }, [button, lead]);
  useReportDockLeast(least);
  return setLead;
}
