import { describe, expect, it, vi, afterEach } from 'vitest';
import { fitViewToBounds } from './fitViewToBounds';
import type { View } from './view';

const CURRENT: View = { x: 999, y: 999, scale: 7 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fitViewToBounds', () => {
  it('centers a square bounds in a square viewport with no padding', () => {
    // bounds 100x100, viewport 200x200, padding 0 -> scale 2 (200/100)
    // worldCenter = (50, 50); view.x = 50 - 200/(2*2) = 50 - 50 = 0
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 200, height: 200 },
      CURRENT,
      { padding: 0 },
    );
    expect(v.scale).toBe(2);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('uses the smaller axis ratio (height-constrained)', () => {
    // bounds 10x100 in viewport 200x200 -> scale = min(200/10, 200/100) = 2
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 10, height: 100 },
      { width: 200, height: 200 },
      CURRENT,
      { padding: 0 },
    );
    expect(v.scale).toBe(2);
  });

  it('applies default 16px padding', () => {
    // viewport 200x200, padding 16 -> avail 168x168; bounds 100x100 -> scale 1.68
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 200, height: 200 },
      CURRENT,
    );
    expect(v.scale).toBeCloseTo(1.68, 5);
  });

  it('caps scale at system max (10) for tiny bounds', () => {
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 1000, height: 1000 },
      CURRENT,
      { padding: 0 },
    );
    expect(v.scale).toBe(10);
  });

  it('respects an explicit maxScale override', () => {
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 1000, height: 1000 },
      CURRENT,
      { padding: 0, maxScale: 4 },
    );
    expect(v.scale).toBe(4);
  });

  it('clamps scale to system min (0.1) for huge bounds', () => {
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 100000, height: 100000 },
      { width: 100, height: 100 },
      CURRENT,
      { padding: 0 },
    );
    expect(v.scale).toBe(0.1);
  });

  it('respects an explicit minScale override', () => {
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 100000, height: 100000 },
      { width: 100, height: 100 },
      CURRENT,
      { padding: 0, minScale: 0.5 },
    );
    expect(v.scale).toBe(0.5);
  });

  it('centers off-origin bounds correctly', () => {
    // bounds at (500, 1000), 100x100; viewport 200x200, padding 0 -> scale 2
    // worldCenter = (550, 1050)
    // view.x = 550 - 200/(2*2) = 550 - 50 = 500
    // view.y = 1050 - 50 = 1000
    const v = fitViewToBounds(
      { x: 500, y: 1000, width: 100, height: 100 },
      { width: 200, height: 200 },
      CURRENT,
      { padding: 0 },
    );
    expect(v.scale).toBe(2);
    expect(v.x).toBe(500);
    expect(v.y).toBe(1000);
    // Sanity-check: world center maps to screen center.
    const screenCx = (550 - v.x) * v.scale;
    const screenCy = (1050 - v.y) * v.scale;
    expect(screenCx).toBe(100);
    expect(screenCy).toBe(100);
  });

  it('returns currentView and warns for zero-width bounds', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 0, height: 100 },
      { width: 200, height: 200 },
      CURRENT,
    );
    expect(v).toBe(CURRENT);
    expect(warn).toHaveBeenCalled();
  });

  it('returns currentView and warns for zero-height bounds', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 100, height: 0 },
      { width: 200, height: 200 },
      CURRENT,
    );
    expect(v).toBe(CURRENT);
    expect(warn).toHaveBeenCalled();
  });

  it('returns currentView and warns for zero-area viewport', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 0, height: 200 },
      CURRENT,
    );
    expect(v).toBe(CURRENT);
    expect(warn).toHaveBeenCalled();
  });
});
