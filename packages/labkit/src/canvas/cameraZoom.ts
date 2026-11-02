import { type View, zoomAt } from '@weasel-js/core';
import type { CameraView } from './CameraInput';

/** `view` at `scale` on both axes, about the screen point `at`. A flipped axis
 *  stays flipped. */
export function atScale(view: View, scale: number, at: { x: number; y: number }): View {
  return zoomAt(view, at, 1, { min: scale, max: scale });
}

/** The middle of the camera's host, in its own screen space; the origin when it cannot measure. */
export function viewMiddle(camera: CameraView): { x: number; y: number } {
  const size = camera.hostSize?.();
  return size ? { x: size.width / 2, y: size.height / 2 } : { x: 0, y: 0 };
}

/** Zoom `camera` to `zoom` about the middle of its view, within its range. */
export function zoomCameraTo(camera: CameraView, zoom: number): void {
  const { min, max } = camera.zoomRange();
  const scale = Math.min(max, Math.max(min, zoom));
  camera.set(atScale(camera.get(), scale, viewMiddle(camera)));
}
