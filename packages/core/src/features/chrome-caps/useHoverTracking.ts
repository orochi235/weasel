/** Last-hovered NodeId for chrome-caps rules. */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { NodeId } from '../../core/scene/types';

/** Options for `useHoverTracking`. */
export interface UseHoverTrackingArgs {
  /** Topmost id under a client point, or null. */
  nodeAtClientPoint: (clientX: number, clientY: number) => { id: NodeId } | null;
  enabled?: boolean;
}

/** What `useHoverTracking` returns. Both members keep their identity. */
export interface HoverTracking {
  /** The node the pointer is over, or null. */
  getHover: () => NodeId | null;
  /** Hand it the element to track, or null to stop: a callback ref, so an
   *  element that mounts after the hook is tracked from the moment it arrives. */
  canvasRef: (element: HTMLElement | null) => void;
}

/** Track which node the pointer is over. Returns a getter rather than state,
 *  so a pointer move does not re-render the component. Cleared on
 *  `pointerleave`. */
export function useHoverTracking(args: UseHoverTrackingArgs): HoverTracking {
  const { nodeAtClientPoint, enabled = true } = args;
  const hoverRef = useRef<NodeId | null>(null);
  const nodeAtRef = useLatest(nodeAtClientPoint);
  const elementRef = useRef<HTMLElement | null>(null);
  const enabledRef = useRef(enabled);
  const detachRef = useRef<(() => void) | null>(null);

  const sync = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
    hoverRef.current = null;
    const el = elementRef.current;
    if (!el || !enabledRef.current) return;
    const onMove = (e: PointerEvent) => {
      hoverRef.current = nodeAtRef.current(e.clientX, e.clientY)?.id ?? null;
    };
    const onLeave = () => { hoverRef.current = null; };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    detachRef.current = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [nodeAtRef]);

  useEffect(() => {
    enabledRef.current = enabled;
    sync();
    return () => {
      detachRef.current?.();
      detachRef.current = null;
      hoverRef.current = null;
    };
  }, [enabled, sync]);

  const canvasRef = useCallback((element: HTMLElement | null) => {
    if (elementRef.current === element) return;
    elementRef.current = element;
    sync();
  }, [sync]);
  const getHover = useCallback(() => hoverRef.current, []);

  return useMemo(() => ({ getHover, canvasRef }), [getHover, canvasRef]);
}
