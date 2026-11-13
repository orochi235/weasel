/** The `camera3d` dep built from the world the other deps were built from. */

import type { Camera3d, OrbitLimits } from './camera';
import type { Camera3dDep } from './cameraDep';
import { viewportOf, type World3d } from './world';

/** Options for `createCameraDep`: what the world's viewport cannot answer. */
export interface CameraDepOptions {
  /** Replaces the camera the world's viewport reads. */
  set(camera: Camera3d): void;
  /** The view whose camera this is, for a `<CanvasView deps>` of its own. Default the surface's. */
  viewId?: string | null;
  /** How far the camera actions may turn and dolly it. Default `DEFAULT_ORBIT_LIMITS`. */
  limits?: () => Partial<OrbitLimits>;
  /** Where `camera.home` returns it. Omitted, `camera.home` does nothing. */
  home?: () => Camera3d;
  /** Where the pane's top-left sits on the canvas, as `Camera3dDep.origin`: the space a wheel's anchor arrives in,
   *  which is not always the space the viewport's `originX`/`originY` are in. Default the canvas origin. */
  origin?: () => { x: number; y: number };
}

/**
 * The `camera3d` dep over `world`: the camera, the pane's size, and the up a pan and a dolly slide against are
 * read from `world`, so the camera actions turn the camera every other dep casts through.
 */
export function createCameraDep<TData, TLayer extends string>(
  world: Pick<World3d<TData, TLayer>, 'viewport' | 'up'>,
  opts: CameraDepOptions,
): Camera3dDep {
  const vp = () => viewportOf(world, opts.viewId);
  return {
    get: () => vp().camera,
    set: opts.set,
    size: () => {
      const { width, height } = vp();
      return { width, height };
    },
    up: () => vp().up,
    ...(opts.origin && { origin: opts.origin }),
    ...(opts.limits && { limits: opts.limits }),
    ...(opts.home && { home: opts.home }),
  };
}
