import { useCallback } from 'react';
import { useLatest } from '@weasel-js/react';
import type { View } from 'core/viewport/view';
import { clientToWorld as clientToWorldHelper } from 'core/viewport/clientToWorld';
import type { CanvasProps } from './canvasProps';

/**
 * The canvas's one client→world conversion: hover, the view registry and both handles answer
 * with it, so a `clientToWorld` override reaches all of them or none.
 */
export function useClientToWorld(
  elementRef: { readonly current: HTMLElement | null },
  clientToWorld: CanvasProps<unknown>['clientToWorld'],
  viewRef: { readonly current: View },
): (clientX: number, clientY: number) => [number, number] {
  const clientToWorldRef = useLatest(clientToWorld);
  return useCallback((clientX: number, clientY: number): [number, number] => {
    const el = elementRef.current;
    if (!el) return [clientX, clientY];
    const override = clientToWorldRef.current;
    if (override) return override(el, clientX, clientY);
    return clientToWorldHelper(clientX, clientY, el.getBoundingClientRect(), viewRef.current);
  }, [elementRef, clientToWorldRef, viewRef]);
}
