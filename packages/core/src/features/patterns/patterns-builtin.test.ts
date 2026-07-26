import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hatch, crosshatch, dots, chunks } from './patterns-builtin';
import { _resetTextureRegistryForTests } from '../../renderer/textures/registerTexture';

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
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    rotate: rec('rotate'),
    ellipse: rec('ellipse'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

class FakeOffscreenCanvas {
  width: number;
  height: number;
  private _ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const made = makeOffCtx();
    this._ctx = made.ctx;
    (this._ctx as unknown as { canvas: FakeOffscreenCanvas }).canvas = this;
  }
  getContext(type: string): CanvasRenderingContext2D | null {
    return type === '2d' ? this._ctx : null;
  }
  transferToImageBitmap(): ImageBitmap {
    return { width: this.width, height: this.height, close: () => {} } as unknown as ImageBitmap;
  }
}

beforeEach(() => {
  (globalThis as unknown as { OffscreenCanvas: typeof FakeOffscreenCanvas }).OffscreenCanvas = FakeOffscreenCanvas;
  _resetTextureRegistryForTests();
});

afterEach(() => {
  delete (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas;
});

describe('built-in patterns', () => {
  it('hatch returns a non-null TextureHandle', () => {
    const h = hatch({ color: 'red' });
    expect(h).not.toBeNull();
    expect(typeof h!.id).toBe('string');
  });

  it('crosshatch returns a non-null TextureHandle', () => {
    const h = crosshatch({ color: '#abcdef', size: 8, lineWidth: 2 });
    expect(h).not.toBeNull();
    expect(typeof h!.id).toBe('string');
  });

  it('dots returns a non-null TextureHandle', () => {
    const h = dots({ color: 'blue', size: 6, radius: 2 });
    expect(h).not.toBeNull();
    expect(typeof h!.id).toBe('string');
  });

  it('chunks returns a non-null TextureHandle', () => {
    const h = chunks({ color: '#fff', bg: '#000', size: 16, density: 0.1, chunkSize: 2, seed: 1 });
    expect(h).not.toBeNull();
    expect(typeof h!.id).toBe('string');
  });
});
