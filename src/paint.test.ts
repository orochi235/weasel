import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPaint,
  applyStroke,
  renderFilledRegion,
  type Paint,
  type Stroke,
} from './paint';

interface Call { fn: string; args: unknown[] }

interface MainCtx {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
  state: {
    fillStyle: CanvasPattern | string;
    strokeStyle: CanvasPattern | string;
    lineWidth: number;
    lineCap: string;
    lineJoin: string;
    globalAlpha: number;
  };
  fakePattern: CanvasPattern & { setTransform: ReturnType<typeof vi.fn> };
}

function makeMainCtx(): MainCtx {
  const calls: Call[] = [];
  const state = {
    fillStyle: '' as CanvasPattern | string,
    strokeStyle: '' as CanvasPattern | string,
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
  };
  const rec = (fn: string) =>
    vi.fn((...args: unknown[]) => { calls.push({ fn, args }); });
  const fakePattern = { setTransform: vi.fn() } as unknown as MainCtx['fakePattern'];
  const ctx = {
    get fillStyle() { return state.fillStyle as unknown as string; },
    set fillStyle(v: CanvasPattern | string) { state.fillStyle = v; },
    get strokeStyle() { return state.strokeStyle as unknown as string; },
    set strokeStyle(v: CanvasPattern | string) { state.strokeStyle = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v: number) { state.lineWidth = v; },
    get lineCap() { return state.lineCap; },
    set lineCap(v: string) { state.lineCap = v; },
    get lineJoin() { return state.lineJoin; },
    set lineJoin(v: string) { state.lineJoin = v; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v: number) { state.globalAlpha = v; },
    save: rec('save'),
    restore: rec('restore'),
    fill: rec('fill'),
    fillRect: rec('fillRect'),
    beginPath: rec('beginPath'),
    ellipse: rec('ellipse'),
    setLineDash: rec('setLineDash'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls, state, fakePattern };
}

class FakeDOMMatrix {
  translateSelf() { return this; }
}

beforeEach(() => {
  if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === 'undefined') {
    (globalThis as unknown as { DOMMatrix: typeof FakeDOMMatrix }).DOMMatrix = FakeDOMMatrix;
  }
});

describe('applyPaint', () => {
  it('sets fillStyle to color and globalAlpha to 1 by default for solid', () => {
    const { ctx, state } = makeMainCtx();
    const paint: Paint = { fill: 'solid', color: '#abcdef' };
    applyPaint(ctx, paint);
    expect(state.fillStyle).toBe('#abcdef');
    expect(state.globalAlpha).toBe(1);
  });

  it('honors explicit opacity on solid', () => {
    const { ctx, state } = makeMainCtx();
    applyPaint(ctx, { fill: 'solid', color: '#000', opacity: 0.25 });
    expect(state.globalAlpha).toBe(0.25);
  });

  it('sets fillStyle to pattern and applies anchor transform', () => {
    const { ctx, state, fakePattern } = makeMainCtx();
    applyPaint(ctx, { fill: 'pattern', pattern: fakePattern, opacity: 0.5 }, { x: 10, y: 20 });
    expect(state.fillStyle).toBe(fakePattern);
    expect(state.globalAlpha).toBe(0.5);
    expect(fakePattern.setTransform).toHaveBeenCalledTimes(1);
  });
});

describe('applyStroke', () => {
  it('sets strokeStyle, width, and dash from a Stroke', () => {
    const { ctx, state } = makeMainCtx();
    const stroke: Stroke = {
      paint: { fill: 'solid', color: '#fff' },
      width: 3,
      dash: [4, 2],
      cap: 'round',
      join: 'bevel',
    };
    applyStroke(ctx, stroke);
    expect(state.strokeStyle).toBe('#fff');
    expect(state.lineWidth).toBe(3);
    expect(state.lineCap).toBe('round');
    expect(state.lineJoin).toBe('bevel');
  });

  it('uses pattern stroke with anchor transform', () => {
    const { ctx, state, fakePattern } = makeMainCtx();
    applyStroke(ctx, { paint: { fill: 'pattern', pattern: fakePattern } }, { x: 5, y: 7 });
    expect(state.strokeStyle).toBe(fakePattern);
    expect(fakePattern.setTransform).toHaveBeenCalledTimes(1);
  });
});

describe('renderFilledRegion', () => {
  it('returns early when paint is null', () => {
    const { ctx, calls } = makeMainCtx();
    renderFilledRegion(ctx, null, { x: 0, y: 0, w: 10, h: 10, shape: 'rectangle' });
    expect(calls).toEqual([]);
  });

  it('paints a rectangle region with solid paint', () => {
    const { ctx, calls, state } = makeMainCtx();
    renderFilledRegion(
      ctx,
      { fill: 'solid', color: '#123456' },
      { x: 10, y: 20, w: 100, h: 50, shape: 'rectangle' },
    );
    const fr = calls.find((c) => c.fn === 'fillRect')!;
    expect(fr.args).toEqual([11, 21, 98, 48]);
    expect(state.fillStyle).toBe('#123456');
    expect(calls[0].fn).toBe('save');
    expect(calls[calls.length - 1].fn).toBe('restore');
  });

  it('paints a circle region with ellipse + fill', () => {
    const { ctx, calls } = makeMainCtx();
    renderFilledRegion(
      ctx,
      { fill: 'solid', color: 'red' },
      { x: 0, y: 0, w: 40, h: 40, shape: 'circle' },
    );
    expect(calls.find((c) => c.fn === 'beginPath')).toBeDefined();
    expect(calls.find((c) => c.fn === 'ellipse')).toBeDefined();
    expect(calls.find((c) => c.fn === 'fill')).toBeDefined();
  });

  it('anchors a pattern paint at (region.x, region.y) by default', () => {
    const { ctx, fakePattern } = makeMainCtx();
    renderFilledRegion(
      ctx,
      { fill: 'pattern', pattern: fakePattern },
      { x: 12, y: 34, w: 10, h: 10, shape: 'rectangle' },
    );
    expect(fakePattern.setTransform).toHaveBeenCalledTimes(1);
  });

  it('honors a caller-supplied anchor', () => {
    const { ctx, fakePattern } = makeMainCtx();
    renderFilledRegion(
      ctx,
      { fill: 'pattern', pattern: fakePattern },
      { x: 12, y: 34, w: 10, h: 10, shape: 'rectangle' },
      { anchor: { x: 0, y: 0 } },
    );
    expect(fakePattern.setTransform).toHaveBeenCalledTimes(1);
  });
});
