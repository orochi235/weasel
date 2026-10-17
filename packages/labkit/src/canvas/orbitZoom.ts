import type { View } from '@weasel-js/core';
import {
  type Camera3d,
  clampCamera,
  DEFAULT_ORBIT_LIMITS,
  type OrbitLimits,
} from '@weasel-js/kernel3d';
import { as3DView } from '../state/view';
import type { CameraView } from './CameraInput';

/** An orbit's magnification: its home distance over its distance now, so 1 at
 *  home, 2 halfway in. What the zoom chrome reads it as. */
export function orbitZoom(camera: Camera3d, home: Camera3d | null): number {
  return (home ?? camera).distance / camera.distance;
}

/** What {@link orbitZoomView} reads, each at the moment it is asked. */
export interface OrbitZoomSource {
  get(): Camera3d;
  set(camera: Camera3d): void;
  home(): Camera3d | null;
  limits(): Partial<OrbitLimits>;
  hostSize(): { width: number; height: number } | null;
}

/**
 * An orbit as a 2D `CameraView` whose scale is its {@link orbitZoom}, so the
 * zoom chrome a lab has for its 2D cameras — the steps, the percentage, actual
 * size — dollies an orbit with no 3D case of its own. Pan has no meaning here:
 * a view handed to `set` moves the distance and nothing else.
 */
export function orbitZoomView(source: OrbitZoomSource): CameraView {
  const homeDistance = (): number => (source.home() ?? source.get()).distance;
  return {
    get: (): View => {
      const z = orbitZoom(source.get(), source.home());
      return { x: 0, y: 0, scale: { x: z, y: z } };
    },
    set: (next: View) => {
      const zoom = next.scale.x;
      if (!(zoom > 0) || !Number.isFinite(zoom)) return;
      const current = source.get();
      source.set(clampCamera({ ...current, distance: homeDistance() / zoom }, source.limits()));
    },
    hostSize: source.hostSize,
    zoomOf: (view) => {
      const camera = as3DView(view);
      return camera ? orbitZoom(camera, source.home()) : null;
    },
    zoomRange: () => {
      const l = { ...DEFAULT_ORBIT_LIMITS, ...source.limits() };
      return { min: homeDistance() / l.maxDistance, max: homeDistance() / l.minDistance };
    },
  };
}
