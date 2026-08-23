// apps/site/demos/platformer/camera.ts
import type { Dims, View } from '@weasel-js/core';
import type { Level, Vec2 } from './level';

/** World units are small (24px tiles), so the camera magnifies. */
export const CAM_SCALE = 2;
/** Half-width / half-height of the box the target moves in freely, in world units. */
export const DEAD_ZONE_X = 28;
export const DEAD_ZONE_Y = 20;
/** Exponential follow rate; higher is snappier. */
export const CAM_LAMBDA = 6;

export interface Camera {
  /** World position the viewport is centered on. */
  x: number;
  y: number;
}

export const createCamera = (at: Vec2): Camera => ({ x: at.x, y: at.y });

const approach = (from: number, to: number, dt: number): number =>
  from + (to - from) * (1 - Math.exp(-CAM_LAMBDA * dt));

/** Clamp a center so the visible span stays inside `[0, extent]`, or center it
 *  outright when the level is smaller than the span. */
function clampCenter(center: number, span: number, extent: number): number {
  if (span >= extent) return extent / 2;
  return Math.min(Math.max(center, span / 2), extent - span / 2);
}

export function followCamera(cam: Camera, target: Vec2, dims: Dims, level: Level, dt: number): Camera {
  const wantX = Math.abs(target.x - cam.x) <= DEAD_ZONE_X
    ? cam.x
    : target.x - Math.sign(target.x - cam.x) * DEAD_ZONE_X;
  const wantY = Math.abs(target.y - cam.y) <= DEAD_ZONE_Y
    ? cam.y
    : target.y - Math.sign(target.y - cam.y) * DEAD_ZONE_Y;

  const spanX = dims.width / CAM_SCALE;
  const spanY = dims.height / CAM_SCALE;
  return {
    x: clampCenter(approach(cam.x, wantX, dt), spanX, level.widthPx),
    y: clampCenter(approach(cam.y, wantY, dt), spanY, level.heightPx),
  };
}

/** The world-space origin of the screen, at the camera's zoom. */
export function cameraView(cam: Camera, dims: Dims): View {
  return {
    x: cam.x - dims.width / CAM_SCALE / 2,
    y: cam.y - dims.height / CAM_SCALE / 2,
    scale: { x: CAM_SCALE, y: CAM_SCALE },
  };
}

/** World point → screen pixels, the inverse of the documented
 *  `worldX = screenX / view.scale.x + view.x`. */
export function worldToScreen(view: View, wx: number, wy: number): { x: number; y: number } {
  return { x: (wx - view.x) * view.scale.x, y: (wy - view.y) * view.scale.y };
}
