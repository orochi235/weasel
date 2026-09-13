import { createContext } from 'react';

/** Where a trial's camera takes a wheel event from outside its own element. */
export type CameraWheelSlot = { current: ((e: WheelEvent) => void) | null };

/**
 * The trial's camera, for input that lands outside it. An annotation target's
 * input box is portalled into the surface container, so a wheel over a mark
 * never bubbles through the stage or canvas stack it sits on; the box hands
 * the event here instead.
 */
export const CameraWheelContext = createContext<CameraWheelSlot | null>(null);
