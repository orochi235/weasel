import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import { useMenuHost } from '@weasel-js/core';

/** An `onContextMenu` handler that opens menu `menu` at the pointer, with `params` passed to
 *  every item. Selecting what was clicked stays the caller's job. The handler changes identity
 *  with `params`, so memoize an object built inline. */
export function useContextMenu(
  menu: string,
  opts: { params?: Record<string, unknown> } = {},
): (e: MouseEvent) => void {
  const host = useMenuHost();
  const { params } = opts;
  return useCallback((e: MouseEvent) => {
    if (!host) return;
    if (host.open({ menu, client: { x: e.clientX, y: e.clientY }, params, source: 'pointer' })) e.preventDefault();
  }, [host, menu, params]);
}
