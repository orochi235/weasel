import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTilePattern } from '.';

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
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

function makeMainCtx() {
  const fakePattern = {} as CanvasPattern;
  const ctx = {
    createPattern: vi.fn(() => fakePattern),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fakePattern };
}

let getContextSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => makeOffCtx().ctx as unknown as RenderingContext,
  );
});

afterEach(() => {
  getContextSpy?.mockRestore();
});

describe('createTilePattern', () => {
  it('invokes the draw callback with the offscreen ctx and size', () => {
    const { ctx } = makeMainCtx();
    const draw = vi.fn();
    createTilePattern(ctx, { size: 8, draw });
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][1]).toBe(8);
  });

  it('returns the CanvasPattern produced by ctx.createPattern', () => {
    const { ctx, fakePattern } = makeMainCtx();
    const result = createTilePattern(ctx, { size: 4, draw: () => {} });
    expect(result).toBe(fakePattern);
  });
});
