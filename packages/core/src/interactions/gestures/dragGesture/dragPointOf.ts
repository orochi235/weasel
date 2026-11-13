import { layoutBoxOf, type ShownElement } from '@weasel-js/routing';
import type { View } from '@weasel-js/geom';
import { clientToWorld } from 'core/viewport/clientToWorld';
import type { DragGesturePoint } from './dragGesture';

const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/**
 * The {@link DragGesturePoint} a pointer event stands for, for feeding
 * `useDragGesture`, `useDragRect`, or `useDragRadial` from raw pointer
 * handlers. `element` is the surface the gesture is measured on. With no
 * `view`, world coordinates are the position inside the element in CSS pixels.
 */
export function dragPointOf(
  event: { clientX: number; clientY: number },
  element: ShownElement,
  view: View = IDENTITY,
): DragGesturePoint {
  const [worldX, worldY] = clientToWorld(event.clientX, event.clientY, layoutBoxOf(element), view);
  return { clientX: event.clientX, clientY: event.clientY, worldX, worldY };
}
