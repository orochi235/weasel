import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTilePattern } from '.';
import {
  getTexture,
  _resetTextureRegistryForTests,
} from '../../renderer/textures/registerTexture';

interface OffCall { fn: string; args: unknown[] }

function makeOffCtx(): { ctx: CanvasRenderingContext2D; calls: OffCall[] } {
  const calls: OffCall[] = [];
  const state = { strokeStyle: '', fillStyle: '', lineWidth: 0 };
  const rec = (fn: string) =>
    vi.fn((...args: unknown[]) => { calls.push({ fn, args }); });
  const ctx = {
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v: string) { state.strokeStyle = v; },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v: string) { state.fillStyle = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v: number) { state.lineWidth = v; },
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    stroke: rec('stroke'),
    arc: rec('arc'),
    fill: rec('fill'),
    fillRect: rec('fillRect'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

let lastOffCanvas: { width: number; height: number; ctx: CanvasRenderingContext2D } | null = null;

class FakeOffscreenCanvas {
  width: number;
  height: number;
  private _ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const made = makeOffCtx();
    this._ctx = made.ctx;
    // Expose canvas back-reference on the ctx so consumers can read
    // `oc.canvas.width` / `oc.canvas.height`.
    (this._ctx as unknown as { canvas: FakeOffscreenCanvas }).canvas = this;
    lastOffCanvas = { width, height, ctx: this._ctx };
  }
  getContext(type: string): CanvasRenderingContext2D | null {
    return type === '2d' ? this._ctx : null;
  }
  transferToImageBitmap(): ImageBitmap {
    return { width: this.width, height: this.height, close: () => {} } as unknown as ImageBitmap;
  }
}

beforeEach(() => {
  lastOffCanvas = null;
  (globalThis as unknown as { OffscreenCanvas: typeof FakeOffscreenCanvas }).OffscreenCanvas = FakeOffscreenCanvas;
  _resetTextureRegistryForTests();
});

afterEach(() => {
  delete (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas;
});

describe('createTilePattern', () => {
  it('invokes the draw callback exactly once with a 2D ctx and the size', () => {
    const draw = vi.fn();
    createTilePattern({ size: 8, draw });
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][1]).toBe(8);
    // First arg is the 2D ctx — sanity check it has the surface we need.
    const oc = draw.mock.calls[0][0] as CanvasRenderingContext2D;
    expect(typeof oc.beginPath).toBe('function');
  });

  it('creates the OffscreenCanvas at the requested size', () => {
    createTilePattern({ size: 8, draw: () => {} });
    expect(lastOffCanvas).not.toBeNull();
    expect(lastOffCanvas!.width).toBe(8);
    expect(lastOffCanvas!.height).toBe(8);
  });

  it('returns a TextureHandle ({ id: string }) on success', () => {
    const handle = createTilePattern({ size: 4, draw: () => {} });
    expect(handle).not.toBeNull();
    expect(typeof handle!.id).toBe('string');
    expect(handle!.id.length).toBeGreaterThan(0);
  });

  it('registers the bitmap so getTexture returns the entry', () => {
    const handle = createTilePattern({ size: 4, draw: () => {} });
    const entry = getTexture(handle!.id);
    expect(entry).not.toBeNull();
    expect(entry!.source).toBeDefined();
  });

  it('returns null when neither OffscreenCanvas nor a usable canvas fallback is available', () => {
    delete (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    // jsdom's HTMLCanvasElement.getContext is not implemented; stub it to
    // return null so the fallback path observes "no 2D ctx" cleanly without
    // jsdom logging a not-implemented warning to stderr.
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => null);
    try {
      const handle = createTilePattern({ size: 4, draw: () => {} });
      expect(handle).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
