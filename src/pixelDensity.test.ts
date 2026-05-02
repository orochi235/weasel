import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupCanvasDpr, useFixedPixelRatio } from './pixelDensity';

describe('setupCanvasDpr', () => {
  let canvas: HTMLCanvasElement;
  let ctx: { setTransform: ReturnType<typeof vi.fn> };
  const originalDpr = window.devicePixelRatio;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    ctx = { setTransform: vi.fn() };
  });

  afterEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true });
  });

  function setDpr(dpr: number) {
    Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
  }

  it('scales the buffer by devicePixelRatio and sets CSS size in css px', () => {
    setDpr(2);
    const dpr = setupCanvasDpr(canvas, ctx as unknown as CanvasRenderingContext2D, 100, 50);
    expect(dpr).toBe(2);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
    expect(canvas.style.width).toBe('100px');
    expect(canvas.style.height).toBe('50px');
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('respects an explicit dpr override', () => {
    setDpr(3);
    setupCanvasDpr(canvas, ctx as unknown as CanvasRenderingContext2D, 100, 50, { dpr: 1 });
    expect(canvas.width).toBe(100);
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
  });

  it('skips the buffer assignment when dimensions already match', () => {
    setDpr(2);
    canvas.width = 200;
    canvas.height = 100;
    const widthSetter = vi.spyOn(canvas, 'width', 'set');
    setupCanvasDpr(canvas, ctx as unknown as CanvasRenderingContext2D, 100, 50);
    expect(widthSetter).not.toHaveBeenCalled();
  });
});

describe('useFixedPixelRatio', () => {
  it('returns 1', () => {
    expect(useFixedPixelRatio()).toBe(1);
  });
});
