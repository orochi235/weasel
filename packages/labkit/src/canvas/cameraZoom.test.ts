import { describe, expect, it } from 'vitest';
import type { CameraView } from './CameraInput';
import { zoomCameraTo } from './cameraZoom';

function fakeCamera(host: { width: number; height: number } | null, range = { min: 0.1, max: 32 }): CameraView & {
  view: { x: number; y: number; scale: { x: number; y: number } };
} {
  const cam = {
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    get: () => cam.view,
    set: (v: { x: number; y: number; scale: { x: number; y: number } }) => {
      const s = Math.min(range.max, Math.max(range.min, v.scale.x));
      cam.view = { ...v, scale: { x: s, y: s } };
    },
    hostSize: () => host,
    zoomRange: () => range,
  };
  return cam;
}

describe('zoomCameraTo', () => {
  it('keeps the middle of the view where it was', () => {
    const cam = fakeCamera({ width: 200, height: 100 });
    zoomCameraTo(cam, 2);
    // The world point under the screen middle (100, 50) is still under it.
    expect(cam.view.x + 100 / cam.view.scale.x).toBeCloseTo(100);
    expect(cam.view.y + 50 / cam.view.scale.y).toBeCloseTo(50);
    expect(cam.view.scale.x).toBe(2);
  });

  it('anchors at the origin when the camera cannot measure its host', () => {
    const cam = fakeCamera(null);
    zoomCameraTo(cam, 2);
    expect(cam.view).toEqual({ x: 0, y: 0, scale: { x: 2, y: 2 } });
  });

  it('stops at the edge of the camera range', () => {
    const cam = fakeCamera({ width: 200, height: 100 }, { min: 0.5, max: 1.2 });
    zoomCameraTo(cam, 5);
    expect(cam.view.scale.x).toBe(1.2);
    expect(cam.view.x + 100 / cam.view.scale.x).toBeCloseTo(100);
  });
});
