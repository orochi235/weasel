import { describe, expect, it, vi } from 'vitest';
import type { CanvasSource } from './canvasSource';
import { canvasPixelSource, compositeOver, createSampler, type PixelSource } from './sampler';

const solid = (rgba: number[] | null, premultiplied = false): PixelSource => ({
  pixel: () => rgba,
  premultiplied,
});

describe('compositeOver', () => {
  it('takes an opaque top layer as it is', () => {
    expect(compositeOver([[255, 0, 0, 255], [0, 0, 255, 255]])).toEqual([255, 0, 0, 255]);
  });

  it('composites a translucent layer over a translucent one, to what a viewer sees', () => {
    // Half red over half blue: red covers half, blue half of what is left.
    expect(compositeOver([[255, 0, 0, 128], [0, 0, 255, 128]])).toEqual([170, 0, 85, 192]);
  });

  it('is null where every layer is transparent, and skips empty layers', () => {
    expect(compositeOver([[9, 9, 9, 0], null])).toBeNull();
    expect(compositeOver([null, [1, 2, 3, 255]])).toEqual([1, 2, 3, 255]);
  });

  it('reads premultiplied bytes as such', () => {
    expect(compositeOver([[96, 0, 0, 128]], [true])).toEqual([191, 0, 0, 128]);
  });
});

describe('createSampler', () => {
  it('reads the stack top-down and stops at the first opaque layer', () => {
    const under = vi.fn(() => [0, 0, 255, 255]);
    const sampler = createSampler([{ pixel: under }, solid([0, 255, 0, 255])]);
    expect(sampler.sample({ x: 0, y: 0 })).toBe('#00ff00');
    expect(under).not.toHaveBeenCalled();
  });

  it('composites translucent layers, listed bottom first', () => {
    const sampler = createSampler([solid([0, 0, 255, 128]), solid([255, 0, 0, 128])]);
    expect(sampler.rgba({ x: 0, y: 0 })).toEqual([170, 0, 85, 192]);
  });

  it('answers null where nothing is drawn', () => {
    expect(createSampler([solid(null), solid([5, 5, 5, 0])]).sample({ x: 0, y: 0 })).toBeNull();
    expect(createSampler([]).sample({ x: 0, y: 0 })).toBeNull();
  });

  it('answers with a promise once a source does, and keeps compositing beneath it', async () => {
    const asyncTop: PixelSource = { pixel: () => Promise.resolve([255, 0, 0, 128]) };
    const sampler = createSampler([solid([0, 0, 255, 128]), asyncTop]);
    const got = sampler.sample({ x: 0, y: 0 });
    expect(got).toBeInstanceOf(Promise);
    await expect(got).resolves.toBe('#aa0055');
  });

  it('reads a stack given as a thunk fresh on every sample', () => {
    let stack = [solid([1, 1, 1, 255])];
    const sampler = createSampler(() => stack);
    expect(sampler.sample({ x: 0, y: 0 })).toBe('#010101');
    stack = [solid([2, 2, 2, 255])];
    expect(sampler.sample({ x: 0, y: 0 })).toBe('#020202');
  });
});

describe('canvasPixelSource', () => {
  it('maps a surface point through the box to the backing store, per axis', () => {
    const pixel = vi.fn(() => Uint8ClampedArray.from([1, 2, 3, 255]));
    const source = { canvas: { width: 200, height: 150 }, pixel } as unknown as CanvasSource;
    const layer = canvasPixelSource(source, () => ({ x: 10, y: 20, width: 100, height: 50 }));
    layer.pixel({ x: 60, y: 45 });
    expect(pixel).toHaveBeenCalledWith({ x: 100, y: 75 });
  });

  it('reads nothing while the box is unknown', () => {
    const pixel = vi.fn();
    const source = { canvas: { width: 1, height: 1 }, pixel } as unknown as CanvasSource;
    expect(canvasPixelSource(source, () => null).pixel({ x: 0, y: 0 })).toBeNull();
    expect(pixel).not.toHaveBeenCalled();
  });
});
