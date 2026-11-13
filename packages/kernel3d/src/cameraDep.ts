/**
 * The kernel's one new dep.
 *
 * `ViewApi` is pan and scale with no orientation, so an orbit camera cannot
 * travel through the kit's `view`. It gets a slot of its own, declared the way
 * any consumer declares one — which is the only place the kernel asks core for
 * anything core does not already offer.
 */

import type { Vec3 } from '@weasel-js/geom/3d';
import type { Camera3d, OrbitLimits } from './camera';

/** The `camera3d` dep: the orbit camera a 3D host owns, which the camera
 *  actions read and replace. */
export interface Camera3dDep {
  get(): Camera3d;
  set(camera: Camera3d): void;
  /** Pane size in CSS pixels — what turns a screen point into a ray. */
  size(): { width: number; height: number };
  /** Where the pane's top-left sits on the canvas, in CSS pixels: the space a
   *  wheel's and a pinch's anchor arrive in. Omitted, the canvas origin. */
  origin?(): { x: number; y: number };
  /** How far the camera actions may turn and dolly it. Omitted,
   *  `DEFAULT_ORBIT_LIMITS`. */
  limits?(): Partial<OrbitLimits>;
  /** The world's up (`World3d.up`), which a pan and a dolly slide the target across the screen against. Omitted
   *  or `undefined`, +y. */
  up?(): Vec3 | undefined;
  /** Where `camera.home` returns it. Omitted, `camera.home` does nothing. */
  home?(): Camera3d;
}

declare module '@weasel-js/core' {
  interface DepSchema {
    camera3d?: Camera3dDep;
  }
}

export {};

// An augmentation that stops merging still compiles — TS just declares a fresh
// interface and nothing names the loss. This says the key really landed.
const _merged: import('@weasel-js/core').DepName = 'camera3d';
void _merged;
