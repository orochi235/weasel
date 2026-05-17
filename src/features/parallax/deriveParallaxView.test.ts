import { describe, it, expect } from 'vitest';
import { deriveParallaxView } from './deriveParallaxView';
import type { View } from '../../core/viewport/view';

const outer: View = { x: 100, y: 50, scale: { x: 2, y: 2 } };

describe('deriveParallaxView', () => {
  it('is identity when pan=1, zoom=1', () => {
    const inner = deriveParallaxView(outer, { pan: 1, zoom: 1 });
    expect(inner).toEqual(outer);
  });

  it('defaults zoom to 1 when omitted', () => {
    const inner = deriveParallaxView(outer, { pan: 1 });
    expect(inner.scale).toEqual({ x: 2, y: 2 });
  });

  it('locks pan to anchor when pan=0', () => {
    const inner = deriveParallaxView(outer, { pan: 0 });
    expect(inner.x).toBe(0);
    expect(inner.y).toBe(0);
  });

  it('locks scale to identity when zoom=0', () => {
    const inner = deriveParallaxView(outer, { pan: 1, zoom: 0 });
    expect(inner.scale).toEqual({ x: 1, y: 1 });
  });

  it('lags pan by factor (anchor at origin)', () => {
    const inner = deriveParallaxView(outer, { pan: 0.5 });
    expect(inner.x).toBe(50);
    expect(inner.y).toBe(25);
  });

  it('respects non-origin anchor for pan', () => {
    const inner = deriveParallaxView(outer, {
      pan: 0.5,
      anchor: { x: 100, y: 50 },
    });
    expect(inner.x).toBe(100);
    expect(inner.y).toBe(50);
  });

  it('treats scalar pan as uniform x/y', () => {
    const scalar = deriveParallaxView(outer, { pan: 0.5 });
    const vector = deriveParallaxView(outer, { pan: { x: 0.5, y: 0.5 } });
    expect(scalar).toEqual(vector);
  });

  it('treats scalar zoom as uniform x/y', () => {
    const scalar = deriveParallaxView(outer, { pan: 1, zoom: 0.5 });
    const vector = deriveParallaxView(outer, { pan: 1, zoom: { x: 0.5, y: 0.5 } });
    expect(scalar).toEqual(vector);
  });

  it('supports per-axis pan split', () => {
    const inner = deriveParallaxView(outer, { pan: { x: 0.5, y: 1 } });
    expect(inner.x).toBe(50);
    expect(inner.y).toBe(50);
  });

  it('linearly interpolates zoom from identity', () => {
    const inner = deriveParallaxView(outer, { pan: 1, zoom: 0.5 });
    expect(inner.scale).toEqual({ x: 1.5, y: 1.5 });
  });
});
