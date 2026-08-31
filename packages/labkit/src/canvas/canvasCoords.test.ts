import { describe, expect, it } from 'vitest';
import { screenToWorld, worldToScreen } from './canvasCoords';
import { resolveFrame } from './worldSpec';

describe('canvasCoords', () => {
  it('identity: zoom=1 pan=0 leaves coords unchanged', () => {
    const v = { zoom: 1, pan: { x: 0, y: 0 } };
    expect(worldToScreen({ x: 7, y: 9 }, v)).toEqual({ x: 7, y: 9 });
    expect(screenToWorld({ x: 7, y: 9 }, v)).toEqual({ x: 7, y: 9 });
  });

  it('zoom only scales coords', () => {
    const v = { zoom: 2, pan: { x: 0, y: 0 } };
    expect(worldToScreen({ x: 3, y: 4 }, v)).toEqual({ x: 6, y: 8 });
    expect(screenToWorld({ x: 6, y: 8 }, v)).toEqual({ x: 3, y: 4 });
  });

  it('pan only translates coords', () => {
    const v = { zoom: 1, pan: { x: 10, y: 20 } };
    expect(worldToScreen({ x: 1, y: 2 }, v)).toEqual({ x: 11, y: 22 });
    expect(screenToWorld({ x: 11, y: 22 }, v)).toEqual({ x: 1, y: 2 });
  });

  it('round-trip is identity', () => {
    const v = { zoom: 1.5, pan: { x: 7, y: -3 } };
    const p = { x: 12.34, y: 56.78 };
    const back = screenToWorld(worldToScreen(p, v), v);
    expect(back.x).toBeCloseTo(p.x, 10);
    expect(back.y).toBeCloseTo(p.y, 10);
  });

  describe('under a declared frame', () => {
    const size = { width: 800, height: 600 };

    it('centres world (0,0) when the origin is the middle of the viewport', () => {
      const frame = resolveFrame({ origin: { x: 0.5, y: 0.5 } }, size);
      const v = { zoom: 1, pan: { x: 0, y: 0 } };
      expect(worldToScreen({ x: 0, y: 0 }, v, frame)).toEqual({ x: 400, y: 300 });
    });

    it('runs y upward when the frame says so', () => {
      const frame = resolveFrame({ yAxis: 'up' }, size);
      const v = { zoom: 2, pan: { x: 0, y: 0 } };
      expect(worldToScreen({ x: 3, y: 5 }, v, frame)).toEqual({ x: 6, y: -10 });
    });

    it('round-trips through a centred, y-up frame', () => {
      const frame = resolveFrame({ origin: { x: 0.5, y: 0.5 }, yAxis: 'up' }, size);
      const v = { zoom: 1.5, pan: { x: 7, y: -3 } };
      const p = { x: 12.34, y: 56.78 };
      const back = screenToWorld(worldToScreen(p, v, frame), v, frame);
      expect(back.x).toBeCloseTo(p.x, 10);
      expect(back.y).toBeCloseTo(p.y, 10);
    });
  });
});
