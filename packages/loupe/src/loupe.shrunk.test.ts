import { describe, expect, it, vi } from 'vitest';
import { ZOOM_FLOOR } from '@weasel-js/geom';
import { loupeSourcePoint, placeBand } from './geometry';
import { createLoupeModel } from './model';

describe('shrunk from the loupe properties', () => {
  it('places a band on a host with no room at a factor a lens point can be mapped back by', () => {
    const got = placeBand({ band: { x: 0, y: 0, w: 0, h: 5e-324 }, factor: 0.01, maxWidth: 0, maxHeight: 0 });
    expect(got.factor).toBe(ZOOM_FLOOR);
    const q = loupeSourcePoint({ x: 0, y: 0 }, { x: 0, y: 0, w: got.width, h: got.height }, got.shows, got.factor);
    expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
  });

  it('never places a lens wider than the host, where rounding the band width up would', () => {
    const got = placeBand({ band: { x: 0, y: 0, w: 5e-324, h: 0 }, factor: 32, maxWidth: 7.4e-323 });
    expect(got.width).toBeLessThanOrEqual(7.4e-323);
  });

  it('asks for no redraw when a factor write clamps to the factor it has', () => {
    const changed = vi.fn();
    const loupe = createLoupeModel({
      surface: { lens: () => null, covers: () => false, sample: () => null, hidden: () => false, gone: () => false, changed },
      minFactor: 0.5, maxFactor: 0.5,
    });
    loupe.setFactor(0);
    loupe.setFactor(1);
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
