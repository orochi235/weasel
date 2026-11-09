import { createCamera } from '@weasel-js/kernel3d';
import { describe, expect, it } from 'vitest';
import { orbitZoomView } from './orbitZoom';

describe('orbitZoomView', () => {
  it("reads a stored view's zoom inside the orbit's own limits, as `get` does", () => {
    const home = createCamera({ distance: 100 });
    const now = createCamera({ distance: 1000 });
    const view = orbitZoomView({
      get: () => now,
      set: () => {},
      home: () => home,
      limits: () => ({ maxDistance: 2000 }),
      hostSize: () => null,
    });
    expect(view.get().scale.x).toBeCloseTo(0.1);
    expect(view.zoomOf(now)).toBeCloseTo(0.1);
  });
});
