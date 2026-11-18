import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFitOnce } from './useFitOnce';
import { fitSize } from './fitSize';
import { fitSize as fitSizeFromEntry } from '../../index';

const fitFilled = (vw: number, vh: number, cw: number, ch: number, fill = 0.85) => fitSize(vw, vh, cw, ch, 0, undefined, fill);

describe('fitSize with a fill is reachable from the public entry', () => {
  it('centers content in a viewport', () => {
    const fit = fitSizeFromEntry(200, 100, 100, 100, 0, undefined, 0.85)!;
    expect(fit.zoom).toBeCloseTo(0.85);
    expect(fit.panX).toBeCloseTo(57.5);
    expect(fit.panY).toBeCloseTo(7.5);
  });
});

describe('fitSize with a fill', () => {
  it('fits content filling 0.85, centered', () => {
    // viewport 200x200, content 10x10 -> avail 170 -> zoom 17 -> contentPx 170
    // pan = (200 - 170) / 2 = 15
    const r = fitFilled(200, 200, 10, 10)!;
    expect(r.zoom).toBe(17);
    expect(r.panX).toBe(15);
    expect(r.panY).toBe(15);
  });

  it('uses another fill', () => {
    // 100x100, fill 0.5 -> avail 50; content 10x10 -> zoom 5; pan = (100-50)/2 = 25
    const r = fitFilled(100, 100, 10, 10, 0.5)!;
    expect(r.zoom).toBe(5);
    expect(r.panX).toBe(25);
    expect(r.panY).toBe(25);
  });

  it('handles non-square content (uses smaller axis ratio)', () => {
    // 100x100, fill 1, content 20x10 -> zoom = min(5, 10) = 5
    // contentPx = 100 x 50 -> panX 0, panY 25
    const r = fitFilled(100, 100, 20, 10, 1)!;
    expect(r.zoom).toBe(5);
    expect(r.panX).toBe(0);
    expect(r.panY).toBe(25);
  });
});

describe('fitSize with a fill and no content', () => {
  it('reports nothing to fit', () => {
    expect(fitFilled(200, 200, 0, 0)).toBeNull();
  });
});

describe('useFitOnce', () => {
  it('leaves the initial view while there is no content, and centers once there is', () => {
    const setZoom = vi.fn();
    const setPan = vi.fn();
    const { rerender } = renderHook(
      ({ c }: { c: number }) => useFitOnce(200, 200, c, c, setZoom, setPan),
      { initialProps: { c: 0 } },
    );
    expect(setZoom).not.toHaveBeenCalled();
    expect(setPan).not.toHaveBeenCalled();
    rerender({ c: 10 });
    expect(setZoom).toHaveBeenCalledWith(17);
    expect(setPan).toHaveBeenCalledWith(15, 15);
  });

  it('does nothing while viewport is zero-sized', () => {
    const setZoom = vi.fn();
    const setPan = vi.fn();
    renderHook(() => useFitOnce(0, 0, 10, 10, setZoom, setPan));
    expect(setZoom).not.toHaveBeenCalled();
    expect(setPan).not.toHaveBeenCalled();
  });

  it('centers exactly once when viewport first has size', () => {
    const setZoom = vi.fn();
    const setPan = vi.fn();
    const { rerender } = renderHook(
      ({ width: w, height: h }: { width: number; height: number }) => useFitOnce(w, h, 10, 10, setZoom, setPan),
      { initialProps: { width: 0, height: 0 } },
    );
    expect(setZoom).not.toHaveBeenCalled();
    rerender({ width: 200, height: 200 });
    expect(setZoom).toHaveBeenCalledTimes(1);
    expect(setPan).toHaveBeenCalledTimes(1);
    // Subsequent size change does not re-center
    rerender({ width: 400, height: 400 });
    expect(setZoom).toHaveBeenCalledTimes(1);
    expect(setPan).toHaveBeenCalledTimes(1);
  });

  it('passes computed fit values to setters', () => {
    const setZoom = vi.fn();
    const setPan = vi.fn();
    renderHook(() => useFitOnce(200, 200, 10, 10, setZoom, setPan));
    // Default padRatio 0.85 -> zoom 17, pan 15
    expect(setZoom).toHaveBeenCalledWith(17);
    expect(setPan).toHaveBeenCalledWith(15, 15);
  });
});
