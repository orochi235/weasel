import { describe, it, expect, vi, afterEach } from 'vitest';
import { ZOOM_FLOOR, normalizeZoom } from './zoomBounds';
import { normalizeView, viewToTransform, type View } from './view';
import { screenToWorld } from './viewTransform';
import { zoomAt } from './zoomAt';
import { wheelZoom } from './wheelHandler';
import { fitViewToBounds } from './fitViewToBounds';

const finitePositive = (n: number) => Number.isFinite(n) && n > 0;

describe('normalizeZoom', () => {
  it.each([0, -0, -1, Number.NaN, Infinity, -Infinity])('clamps %s to the floor', (z) => {
    expect(normalizeZoom(z)).toBe(ZOOM_FLOOR);
  });

  it('clamps a positive zoom below the floor up to it', () => {
    expect(normalizeZoom(ZOOM_FLOOR / 1000)).toBe(ZOOM_FLOOR);
  });

  it('passes a valid zoom through unchanged', () => {
    expect(normalizeZoom(2)).toBe(2);
    expect(normalizeZoom(ZOOM_FLOOR)).toBe(ZOOM_FLOOR);
  });
});

describe('normalizeView', () => {
  it('returns the same object for a valid view', () => {
    const v: View = { x: 3, y: -4, scale: { x: 2, y: 0.5 } };
    expect(normalizeView(v)).toBe(v);
  });

  it('clamps a zero or non-finite scale axis to the floor', () => {
    expect(normalizeView({ x: 0, y: 0, scale: { x: 0, y: Number.NaN } }).scale)
      .toEqual({ x: ZOOM_FLOOR, y: ZOOM_FLOOR });
    expect(normalizeView({ x: 0, y: 0, scale: { x: -0, y: Infinity } }).scale)
      .toEqual({ x: ZOOM_FLOOR, y: ZOOM_FLOOR });
  });

  it('keeps a negative axis negative, since that is how a view spells y-up', () => {
    const v: View = { x: 0, y: 0, scale: { x: 1, y: -2 } };
    expect(normalizeView(v)).toBe(v);
    expect(normalizeView({ x: 0, y: 0, scale: { x: 1, y: -ZOOM_FLOOR / 10 } }).scale.y).toBe(-ZOOM_FLOOR);
  });

  it('zeroes a non-finite translation', () => {
    expect(normalizeView({ x: Number.NaN, y: -Infinity, scale: { x: 1, y: 1 } }))
      .toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  });

  it('leaves screenToWorld finite for a view that arrived with zoom 0', () => {
    const [wx, wy] = screenToWorld(120, 80, viewToTransform(normalizeView({ x: 5, y: 5, scale: { x: 0, y: 0 } })));
    expect(Number.isFinite(wx)).toBe(true);
    expect(Number.isFinite(wy)).toBe(true);
  });
});

describe('zoom producers stay inside the invariant', () => {
  const HOME: View = { x: 10, y: 10, scale: { x: 1, y: 1 } };

  it('zoomAt with a zero factor and a zero min', () => {
    const next = zoomAt(HOME, { x: 50, y: 50 }, 0, { min: 0 });
    expect(finitePositive(next.scale.x)).toBe(true);
    expect(finitePositive(next.scale.y)).toBe(true);
    expect(Number.isFinite(next.x)).toBe(true);
    expect(Number.isFinite(next.y)).toBe(true);
  });

  it('zoomAt with a NaN factor', () => {
    const next = zoomAt(HOME, { x: 50, y: 50 }, Number.NaN);
    expect(finitePositive(next.scale.x)).toBe(true);
    expect(Number.isFinite(next.x)).toBe(true);
  });

  it('a wheel sample large enough to underflow the factor, with a zero min', () => {
    const next = wheelZoom(HOME, { x: 50, y: 50 }, 1e6, { min: 0 });
    expect(finitePositive(next.scale.x)).toBe(true);
    expect(Number.isFinite(next.x)).toBe(true);
  });

  it('fitViewToBounds with an unbounded maxScale over bounds too thin to measure', () => {
    const v = fitViewToBounds({ x: 0, y: 0, width: Number.MIN_VALUE, height: Number.MIN_VALUE }, { width: 100, height: 100 }, HOME, { maxScale: Infinity });
    expect(finitePositive(v.scale.x)).toBe(true);
    expect(Number.isFinite(v.x)).toBe(true);
  });
});

describe('invalid-zoom dev warning', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

  it('warns once, and only for a zoom that was never valid', async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fresh = await import('./zoomBounds');
    fresh.normalizeZoom(fresh.ZOOM_FLOOR / 1000);
    expect(warn).not.toHaveBeenCalled();
    fresh.normalizeZoom(0);
    fresh.normalizeZoom(Number.NaN);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
