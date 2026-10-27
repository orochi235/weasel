import type { ViewTarget } from 'domains/viewports/viewResolver';
import type { CanvasExtensionApi } from '../canvasExtension';

/**
 * A client point in the world of the view it resolved to. The canvas's own
 * view converts through the handle, and a declared view through the resolver,
 * which reads the canvas by the same conversion.
 */
export function worldPointAt(
  api: Pick<CanvasExtensionApi, 'clientToWorld'>,
  target: ViewTarget | undefined,
  clientX: number,
  clientY: number,
): [number, number] {
  if (!target || target.id === null) return api.clientToWorld(clientX, clientY);
  return [target.world.x, target.world.y];
}
