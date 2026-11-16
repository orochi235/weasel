import { useEffect, useRef, useState } from 'react';
import { useKitSetting } from '@weasel-js/react';
import { after } from '@weasel-js/registry';
import type {} from '../../kitSettings';

/** How long the pointer or keyboard focus rests on a row before its tooltip opens. */
export const REST_MS = 300;

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
  const restMs = useKitSetting('tree.tipRestMs') ?? REST_MS;
  const cancelRest = useRef<(() => void) | null>(null);
  const clear = (): void => {
    cancelRest.current?.();
    cancelRest.current = null;
    setTip((cur) => (cur === null ? cur : null));
  };
  const rest = (id: string, el: HTMLElement): void => {
    cancelRest.current?.();
    cancelRest.current = after(restMs, () => setTip({ id, el }));
  };
  useEffect(() => () => {
    cancelRest.current?.();
  }, []);
  return { tip, rest, clear };
}
