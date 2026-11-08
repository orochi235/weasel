import type { ControlPoint, EndpointMode } from './functionLayerTypes';

/** Whether anchor `index` of `count` is an endpoint `endpoints` pins in place. */
export function isPinnedEndpointAt(index: number, count: number, endpoints: EndpointMode): boolean {
  if (endpoints === 'free') return false;
  return index === 0 || index === count - 1;
}

/** Whether anchor `index` goes undrawn: one that cannot move, under `hideNonInteractive`. Undrawn, it takes no press. */
export function isHiddenAnchor(points: readonly ControlPoint[], index: number, endpoints: EndpointMode, hideNonInteractive: boolean | undefined): boolean {
  return !!hideNonInteractive && (points[index]?.locked === true || isPinnedEndpointAt(index, points.length, endpoints));
}
