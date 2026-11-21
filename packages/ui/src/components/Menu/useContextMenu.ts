import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import { useMenuHost } from '@weasel-js/routing/react';

/** An `onContextMenu` handler that opens menu `menu` at the pointer, with `params` passed to
 *  every item; one raised by Shift+F10 or the ContextMenu key opens with its first row highlighted. Selecting what was clicked stays the caller's job. The handler changes identity
 *  with `params`, so memoize an object built inline. */
export function useContextMenu(
  menu: string,
  opts: { params?: Record<string, unknown> } = {},
): (e: MouseEvent) => void {
  const host = useMenuHost();
  const { params } = opts;
  return useCallback((e: MouseEvent) => {
    if (!host) return;
    const source = fromKeyboard(e.nativeEvent) ? 'keyboard' : 'pointer';
    if (host.open({ menu, client: { x: e.clientX, y: e.clientY }, params, source })) e.preventDefault();
  }, [host, menu, params]);
}

/** Whether a `contextmenu` came from Shift+F10 or the ContextMenu key: Chromium fires it as a pointer event of no
 *  pointer type, Firefox marks its input source as the keyboard (6). */
function fromKeyboard(e: Event): boolean {
  const n = e as Event & { pointerType?: string; mozInputSource?: number };
  return n.pointerType === '' || n.mozInputSource === 6;
}
