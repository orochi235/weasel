import { useEffect, useRef, useState } from 'react';

/** How long the pointer or keyboard focus rests on a row before its tooltip opens: the kit tooltip's own delay. */
const REST_MS = 600;

/** The row whose tooltip is open, and the element the tooltip points at. */
export interface RowTip {
  id: string;
  el: HTMLElement;
}

/**
 * Which row's tooltip is open. A row is not a tooltip trigger of React Aria's: that would make the row itself
 * focusable, and a tree keeps focus on its items. So the tree times the rest itself and hands the tooltip the row.
 */
export function useRowTip(): { tip: RowTip | null; rest(id: string, el: HTMLElement): void; clear(): void } {
  const [tip, setTip] = useState<RowTip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setTip((cur) => (cur === null ? cur : null));
  };
  const rest = (id: string, el: HTMLElement): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTip({ id, el }), REST_MS);
  };
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  return { tip, rest, clear };
}
