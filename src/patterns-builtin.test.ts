import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hatch, crosshatch, dots, chunks } from './patterns-builtin';

interface OffCall { fn: string; args: unknown[]; strokeStyle?: string; fillStyle?: string }

function makeOffCtx() {
  const calls: OffCall[] = [];
  const state = { strokeStyle: '', fillStyle: '', lineWidth: 0 };
  const rec = (fn: string, capture: 'stroke' | 'fill' | null = null) =>
    vi.fn((...args: unknown[]) => {
      const c: OffCall = { fn, args };
      if (capture === 'stroke') c.strokeStyle = state.strokeStyle;
      if (capture === 'fill') c.fillStyle = state.fillStyle;
      calls.push(c);
    });
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
    stroke: rec('stroke', 'stroke'),
    arc: rec('arc'),
    fill: rec('fill', 'fill'),
    fillRect: rec('fillRect', 'fill'),
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    rotate: rec('rotate'),
    ellipse: rec('ellipse'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

let getContextSpy: ReturnType<typeof vi.spyOn> | null = null;
let lastOff: ReturnType<typeof makeOffCtx> | null = null;

function makeMainCtx() {
  const fakePattern = {} as CanvasPattern;
  const ctx = {
    createPattern: vi.fn(() => fakePattern),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fakePattern };
}

beforeEach(() => {
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => {
      lastOff = makeOffCtx();
      return lastOff.ctx as unknown as RenderingContext;
    },
  );
});

afterEach(() => {
  getContextSpy?.mockRestore();
  lastOff = null;
});

describe('hatch', () => {
  it('strokes with the supplied color and uses default size 5', () => {
    const { ctx } = makeMainCtx();
    hatch(ctx, { color: 'red' });
    const strokes = lastOff!.calls.filter((c) => c.fn === 'stroke');
    expect(strokes.length).toBe(1);
    expect(strokes[0].strokeStyle).toBe('red');
  });
});

describe('crosshatch', () => {
  it('strokes with the supplied color', () => {
    const { ctx } = makeMainCtx();
    crosshatch(ctx, { color: '#abcdef', size: 8, lineWidth: 2 });
    const strokes = lastOff!.calls.filter((c) => c.fn === 'stroke');
    expect(strokes[0].strokeStyle).toBe('#abcdef');
  });
});

describe('dots', () => {
  it('fills a single dot per tile with the supplied color', () => {
    const { ctx } = makeMainCtx();
    dots(ctx, { color: 'blue', size: 6, radius: 2 });
    const arcs = lastOff!.calls.filter((c) => c.fn === 'arc');
    expect(arcs).toHaveLength(1);
    expect(arcs[0].args).toEqual([3, 3, 2, 0, Math.PI * 2]);
    const fills = lastOff!.calls.filter((c) => c.fn === 'fill');
    expect(fills[0].fillStyle).toBe('blue');
  });
});

describe('chunks', () => {
  it('paints bg fillRect when bg is supplied', () => {
    const { ctx } = makeMainCtx();
    chunks(ctx, { color: '#fff', bg: '#000', size: 16, density: 0.1, chunkSize: 2, seed: 1 });
    const bgFills = lastOff!.calls.filter((c) => c.fn === 'fillRect');
    expect(bgFills).toHaveLength(1);
    expect(bgFills[0].fillStyle).toBe('#000');
    expect(bgFills[0].args).toEqual([0, 0, 16, 16]);
  });

  it('omits bg fillRect when bg is undefined', () => {
    const { ctx } = makeMainCtx();
    chunks(ctx, { color: '#fff', size: 16, density: 0.1, chunkSize: 2, seed: 1 });
    const bgFills = lastOff!.calls.filter((c) => c.fn === 'fillRect');
    expect(bgFills).toHaveLength(0);
  });

  it('is deterministic for a given seed (same number of chunks)', () => {
    const { ctx } = makeMainCtx();
    chunks(ctx, { color: '#fff', size: 16, density: 0.2, chunkSize: 2, seed: 7 });
    const ellipses1 = lastOff!.calls.filter((c) => c.fn === 'ellipse').length;

    chunks(ctx, { color: '#fff', size: 16, density: 0.2, chunkSize: 2, seed: 7 });
    const ellipses2 = lastOff!.calls.filter((c) => c.fn === 'ellipse').length;

    expect(ellipses2).toBe(ellipses1);
    expect(ellipses1).toBeGreaterThan(0);
  });
});
