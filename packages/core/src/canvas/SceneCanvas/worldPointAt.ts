import { clientToWorld } from 'core/viewport/clientToWorld';
import type { ViewTarget } from 'features/viewports/viewResolver';
import type { CanvasExtensionApi } from '../canvasExtension';

/**
 * A client point in the world of the view it resolved to. The canvas's own
 * view converts through the handle, which honors a `clientToWorld` override;
 * a declared view has a rect and a camera of its own, which the override
 * knows nothing about.
 */
export function worldPointAt(
  api: Pick<CanvasExtensionApi, 'clientToWorld'>,
  target: ViewTarget | undefined,
  clientX: number,
  clientY: number,
): [number, number] {
  if (!target || target.id === null) return api.clientToWorld(clientX, clientY);
  return clientToWorld(clientX, clientY, target.origin, target.view);
}
