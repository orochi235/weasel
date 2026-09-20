import { describe, expect, it } from 'vitest';
import { PATH_L, PATH_M, PATH_Z } from './types';
import { circlePath, rectMarkerPath, roundRectPath, squarePath } from './markers';

describe('marker builders', () => {
  it('circlePath closes after `segments` vertices', () => {
    const p = circlePath(0, 0, 10, 8);
    expect(Array.from(p.commands)).toEqual([PATH_M, PATH_L, PATH_L, PATH_L, PATH_L, PATH_L, PATH_L, PATH_L, PATH_Z]);
    expect(p.coords).toHaveLength(16);
  });

  it('squarePath centers on (cx, cy)', () => {
    const p = squarePath(10, 20, 4);
    expect(Array.from(p.coords)).toEqual([8, 18, 12, 18, 12, 22, 8, 22]);
  });

  it('rectMarkerPath takes a top-left corner', () => {
    const p = rectMarkerPath(1, 2, 10, 4);
    expect(Array.from(p.coords)).toEqual([1, 2, 11, 2, 11, 6, 1, 6]);
  });

  describe('roundRectPath', () => {
    it('degenerates to a plain rect at r = 0', () => {
      expect(roundRectPath(1, 2, 10, 4, 0)).toEqual(rectMarkerPath(1, 2, 10, 4));
    });

    it('clamps the radius to half the shorter side', () => {
      const clamped = roundRectPath(0, 0, 20, 10, 50);
      expect(clamped).toEqual(roundRectPath(0, 0, 20, 10, 5));
    });

    it('stays inside its own box', () => {
      const p = roundRectPath(0, 0, 20, 10, 3);
      for (let i = 0; i < p.coords.length; i += 2) {
        expect(p.coords[i]).toBeGreaterThanOrEqual(-1e-5);
        expect(p.coords[i]).toBeLessThanOrEqual(20 + 1e-5);
        expect(p.coords[i + 1]).toBeGreaterThanOrEqual(-1e-5);
        expect(p.coords[i + 1]).toBeLessThanOrEqual(10 + 1e-5);
      }
    });

    it('touches each edge midpoint', () => {
      const p = roundRectPath(0, 0, 20, 10, 3);
      const pts = new Set<string>();
      for (let i = 0; i < p.coords.length; i += 2) pts.add(`${p.coords[i]},${p.coords[i + 1]}`);
      // The arc terminals are where the straight edges begin and end.
      expect(pts.has('3,0')).toBe(true);
      expect(pts.has('17,0')).toBe(true);
      expect(pts.has('20,3')).toBe(true);
      expect(pts.has('0,7')).toBe(true);
    });

    it('emits one M, one Z, and lines between', () => {
      const p = roundRectPath(0, 0, 20, 10, 3, 4);
      expect(p.commands[0]).toBe(PATH_M);
      expect(p.commands[p.commands.length - 1]).toBe(PATH_Z);
      expect(p.commands).toHaveLength(4 * 5 + 1);
      expect(Array.from(p.commands).filter((c) => c === PATH_M)).toHaveLength(1);
    });
  });
});
