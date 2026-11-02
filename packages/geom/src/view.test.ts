import { describe, expect, it } from 'vitest';
import { normalizeZoom, viewRectToScreen, viewScreenToWorld, viewWorldToScreen, ZOOM_FLOOR, type View } from './view';
import { viewToMat3 } from './viewToMat3';

describe('normalizeZoom', () => {
  it('passes a finite zoom at or above the floor', () => {
    for (const z of [ZOOM_FLOOR, 0.1, 1, 8, 1e12]) expect(normalizeZoom(z)).toBe(z);
  });

  it('gives the floor for anything else', () => {
    for (const z of [0, -1, ZOOM_FLOOR / 2, Number.NaN, Infinity, -Infinity]) expect(normalizeZoom(z)).toBe(ZOOM_FLOOR);
  });
});

const STRETCHED: View = { x: 10, y: -4, scale: { x: 2, y: 0.5 } };
const Y_UP: View = { x: 10, y: 50, scale: { x: 2, y: -3 } };

describe('viewWorldToScreen / viewScreenToWorld', () => {
  it('puts the view origin at the canvas top-left', () => {
    expect(viewWorldToScreen(STRETCHED, { x: 10, y: -4 })).toEqual({ x: 0, y: 0 });
    expect(viewScreenToWorld(STRETCHED, { x: 0, y: 0 })).toEqual({ x: 10, y: -4 });
  });

  it('scales each axis by its own zoom', () => {
    expect(viewWorldToScreen(STRETCHED, { x: 15, y: 6 })).toEqual({ x: 10, y: 5 });
  });

  it('agrees with viewToMat3', () => {
    for (const view of [STRETCHED, Y_UP]) {
      const m = viewToMat3(view);
      const p = { x: 7, y: 11 };
      expect(viewWorldToScreen(view, p)).toEqual({ x: m[0] * p.x + m[6], y: m[4] * p.y + m[7] });
    }
  });

  it('round-trips, including through a flipped axis', () => {
    for (const view of [STRETCHED, Y_UP]) {
      const back = viewScreenToWorld(view, viewWorldToScreen(view, { x: 7, y: 11 }));
      expect(back.x).toBeCloseTo(7, 12);
      expect(back.y).toBeCloseTo(11, 12);
    }
  });
});

describe('viewRectToScreen', () => {
  it('moves the corner and scales the size per axis', () => {
    expect(viewRectToScreen(STRETCHED, { x: 12, y: 0, width: 5, height: 8 })).toEqual({ x: 4, y: 2, width: 10, height: 4 });
  });

  it('keeps a positive size with its top-left on screen under a flipped axis', () => {
    // World y 40..42 under y-up: screen y = (40-50)*-3 = 30 and (42-50)*-3 = 24.
    expect(viewRectToScreen(Y_UP, { x: 10, y: 40, width: 1, height: 2 })).toEqual({ x: 0, y: 24, width: 2, height: 6 });
  });
});
