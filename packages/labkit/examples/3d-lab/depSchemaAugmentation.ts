/**
 * The lab's own dep. `ViewApi` is pan and scale with no orientation, so an
 * orbit camera cannot travel through the kit's `view` — it gets a slot of its
 * own, declared the way any consumer declares one.
 */

import type { Camera3d } from './camera3d';

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
