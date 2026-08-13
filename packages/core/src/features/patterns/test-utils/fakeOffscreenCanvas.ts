/**
 * jsdom has no `OffscreenCanvas`, so `createTilePattern` returns null there
 * and every pattern test would assert against nothing. This installs a fake
 * that records 2D calls and hands back a stub `ImageBitmap`.
 */

import { vi } from 'vitest';

export interface OffCall { fn: string; args: unknown[] }

export interface FakeOffscreenState {
  /** The most recently constructed canvas, for size assertions. */
  last: { width: number; height: number; ctx: CanvasRenderingContext2D } | null;
  /** Every 2D call made on the most recent canvas, in order. */
  calls: OffCall[];
}

export function makeOffCtx(calls: OffCall[]): CanvasRenderingContext2D {
  const state = { strokeStyle: '', fillStyle: '', lineWidth: 0 };
  const rec = (fn: string) =>
    vi.fn((...args: unknown[]) => { calls.push({ fn, args }); });
  return {
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
    ellipse: rec('ellipse'),
    fill: rec('fill'),
    fillRect: rec('fillRect'),
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    rotate: rec('rotate'),
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Install the fake on `globalThis` and return the state it records into.
 * Call from `beforeEach`; pair with {@link uninstallFakeOffscreenCanvas}.
 */
export function installFakeOffscreenCanvas(): FakeOffscreenState {
  const state: FakeOffscreenState = { last: null, calls: [] };

  class FakeOffscreenCanvas {
    width: number;
    height: number;
    private _ctx: CanvasRenderingContext2D;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      state.calls.length = 0;
      this._ctx = makeOffCtx(state.calls);
      (this._ctx as unknown as { canvas: FakeOffscreenCanvas }).canvas = this;
      state.last = { width, height, ctx: this._ctx };
    }
    getContext(type: string): CanvasRenderingContext2D | null {
      return type === '2d' ? this._ctx : null;
    }
    transferToImageBitmap(): ImageBitmap {
      return { width: this.width, height: this.height, close: () => {} } as unknown as ImageBitmap;
    }
  }

  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = FakeOffscreenCanvas;
  return state;
}

export function uninstallFakeOffscreenCanvas(): void {
  delete (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas;
}
