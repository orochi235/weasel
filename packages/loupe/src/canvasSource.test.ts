import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasSource, sourcePixel, sourceRegion } from './canvasSource';

// jsdom has no canvas to draw into, so the snapshot and probe canvases are a
// stand-in that records what was copied. What the copied pixels look like is
// `SourceLoupe.browser.test.tsx`'s job, in labkit.

interface FakeCtx {
  globalCompositeOperation: string;
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: () => { data: Uint8ClampedArray };
}

let made: Array<{ width: number; height: number; ctx: FakeCtx }> = [];

class FakeOffscreen {
  ctx: FakeCtx = {
    globalCompositeOperation: 'source-over',
    drawImage: vi.fn(),
    getImageData: () => ({ data: Uint8ClampedArray.from([10, 20, 30, 255]) }),
  };
  constructor(
    public width: number,
    public height: number,
  ) {
    made.push(this);
  }
  getContext() {
    return this.ctx;
  }
}

beforeEach(() => {
  made = [];
  vi.stubGlobal('OffscreenCanvas', FakeOffscreen);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function canvas(width = 200, height = 100): HTMLCanvasElement {
  // A canvas stand-in: `getContext` is what tells it apart from a context.
  return { width, height, getContext: () => null } as unknown as HTMLCanvasElement;
}

function gl(preserveDrawingBuffer: boolean, c = canvas()): WebGLRenderingContext {
  return {
    canvas: c,
    drawArrays: () => undefined,
    getContextAttributes: () => ({ preserveDrawingBuffer }),
  } as unknown as WebGLRenderingContext;
}

describe('createCanvasSource', () => {
  it('captures a WebGL context that does not preserve its buffer', () => {
    expect(createCanvasSource(gl(false)).captured).toBe(true);
    expect(createCanvasSource(gl(true)).captured).toBe(false);
  });

  it('reads a bare canvas directly, until something captures it', () => {
    const c = canvas();
    const s = createCanvasSource(c);
    expect(s.captured).toBe(false);
    expect(s.frame()).toBe(c);
    s.capture();
    expect(s.captured).toBe(true);
  });

  it('copies nothing while no reader holds it', () => {
    const s = createCanvasSource(gl(false));
    s.capture();
    expect(made).toHaveLength(0);
    expect(s.frame()).toBeNull();
  });

  it('copies the whole backing store while held, replacing the last frame', () => {
    const c = canvas(64, 32);
    const s = createCanvasSource(gl(false, c));
    const release = s.retain();
    s.capture();
    expect(made[0]).toMatchObject({ width: 64, height: 32 });
    expect(made[0].ctx.globalCompositeOperation).toBe('copy');
    expect(made[0].ctx.drawImage).toHaveBeenCalledWith(c, 0, 0);
    expect(s.frame()).toBe(made[0]);
    release();
    s.capture();
    expect(made[0].ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('asks for a redraw when the first reader arrives, and treats the old frame as stale', () => {
    const requestRedraw = vi.fn();
    const s = createCanvasSource(gl(false), { requestRedraw });
    const first = s.retain();
    expect(requestRedraw).toHaveBeenCalledTimes(1);
    s.capture();
    expect(s.frame()).not.toBeNull();
    // A second reader joining is not a first reader arriving.
    const second = s.retain();
    expect(requestRedraw).toHaveBeenCalledTimes(1);
    first();
    second();
    s.retain();
    expect(requestRedraw).toHaveBeenCalledTimes(2);
    expect(s.frame()).toBeNull();
  });

  it('asks for no redraw on a source read directly', () => {
    const requestRedraw = vi.fn();
    createCanvasSource(gl(true), { requestRedraw }).retain();
    expect(requestRedraw).not.toHaveBeenCalled();
  });

  it('notifies frame subscribers on each capture', () => {
    const s = createCanvasSource(gl(false));
    const fn = vi.fn();
    const off = s.subscribeFrame(fn);
    s.retain();
    s.capture();
    off();
    s.capture();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('warns once when a captured source is read and never captured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const s = createCanvasSource(gl(false));
    s.retain();
    for (let i = 0; i < 500; i++) s.frame();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('samples a backing-store pixel as hex, and nothing off the canvas', () => {
    const s = createCanvasSource(canvas(200, 100));
    expect(s.sample({ x: 5.7, y: 3.2 })).toBe('#0a141e');
    expect(made[0].ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 5, 3, 1, 1, 0, 0, 1, 1);
    expect(s.sample({ x: 200, y: 0 })).toBeNull();
    expect(s.sample({ x: -1, y: 0 })).toBeNull();
  });

  it('never calls getContext on the canvas it reads', () => {
    const c = canvas();
    const getContext = vi.fn(() => null);
    (c as unknown as { getContext: typeof getContext }).getContext = getContext;
    const s = createCanvasSource(c);
    s.retain();
    s.sample({ x: 1, y: 1 });
    s.capture();
    expect(getContext).not.toHaveBeenCalled();
  });
});

describe('source geometry', () => {
  const box = { x: 10, y: 20, width: 100, height: 50 };
  const backing = { width: 200, height: 150 };

  it('maps a surface point through the box to the backing store, per axis', () => {
    expect(sourcePixel({ x: 60, y: 45 }, box, backing)).toEqual({ x: 100, y: 75 });
  });

  it('copies the diameter-over-factor CSS px around the aim, in device px', () => {
    expect(sourceRegion({ x: 60, y: 45 }, 4, 40, box, backing)).toEqual({
      sx: 90,
      sy: 60,
      sw: 20,
      sh: 30,
    });
  });
});
