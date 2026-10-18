import type { ActionsRegistry } from '@weasel-js/core';
import { createContext, type RefObject, useContext, useEffect } from 'react';

/** Where a trial's camera takes a wheel event from outside its own element. */
export type CameraWheelSlot = { current: ((e: WheelEvent) => void) | null };

/**
 * The trial's camera, for input that lands outside it. An annotation target's
 * input box is portalled into the surface container, so a wheel over a mark
 * never bubbles through the stage or canvas stack it sits on; the box hands
 * the event here instead.
 */
export const CameraWheelContext = createContext<CameraWheelSlot | null>(null);

/** Claims the trial's wheel slot for the camera dispatching on `hostRef`
 *  whenever its scope, `registry`, is the active one. */
export function useCameraWheelSlot(
  hostRef: RefObject<HTMLElement | null>,
  registry: ActionsRegistry,
): void {
  const wheelSlotRef = useContext(CameraWheelContext);
  useEffect(() => {
    if (!wheelSlotRef) return;
    const forward = (e: WheelEvent): void => {
      // The dispatcher cancels the copy it takes; the page acts on the original.
      const taken = hostRef.current?.dispatchEvent(new WheelEvent('wheel', e)) === false;
      if (taken) e.preventDefault();
    };
    const claim = (): void => {
      if (registry.isActive()) wheelSlotRef.current = forward;
    };
    claim();
    const off = registry.subscribe(claim);
    return () => {
      off();
      if (wheelSlotRef.current === forward) wheelSlotRef.current = null;
    };
  }, [wheelSlotRef, hostRef, registry]);
}
