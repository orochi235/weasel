/**
 * The kernel's one new dep.
 *
 * `ViewApi` is pan and scale with no orientation, so an orbit camera cannot
 * travel through the kit's `view`. It gets a slot of its own, declared the way
 * any consumer declares one — which is the only place the kernel asks core for
 * anything core does not already offer.
 */

import type { Camera3d } from './camera';

export interface Camera3dDep {
  get(): Camera3d;
  set(camera: Camera3d): void;
  /** Pane size in CSS pixels — what turns a screen point into a ray. */
  size(): { width: number; height: number };
}

declare module '@weasel-js/core' {
  interface DepSchema {
    camera3d?: Camera3dDep;
  }
}

export {};
