import { describe, it, expect } from 'vitest';
import type { View } from './view';
import { viewToTransform } from './view';
import { worldToScreen, screenToWorld } from './viewTransform';

describe('viewToTransform', () => {
  it('inverts the camera-position convention into ViewTransform pan', () => {
    const view: View = { x: 100, y: 50 };
    const t = viewToTransform(view);
    expect(t).toEqual({ panX: -100, panY: -50, zoom: 1 });
  });

  it('round-trips world↔screen with worldToScreen using the adapter', () => {
    const view: View = { x: 30, y: -20 };
    const t = viewToTransform(view);
    // World point that is at the camera-top-left should map to screen (0, 0).
    expect(worldToScreen(view.x, view.y, t)).toEqual([0, 0]);
    // And inversely.
    expect(screenToWorld(0, 0, t)).toEqual([view.x, view.y]);
  });

  it('zero view is identity', () => {
    expect(viewToTransform({ x: 0, y: 0 })).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });
});
