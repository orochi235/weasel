import { describe, expect, it } from 'vitest';
import { worldToScreen } from './canvasCoords';
import { applyCamera, DEFAULT_FRAME, resolveFrame } from './worldSpec';

const SIZE = { width: 800, height: 600 };

describe('resolveFrame', () => {
  it('defaults to labkit original convention: origin top-left, y down', () => {
    expect(resolveFrame(undefined, SIZE)).toEqual(DEFAULT_FRAME);
  });

  it('places a fractional origin at that fraction of the viewport', () => {
    const frame = resolveFrame({ origin: { x: 0.5, y: 0.5 } }, SIZE);
    expect(frame.originPx).toEqual({ x: 400, y: 300 });
  });

  it('reads yAxis up as a negated y direction', () => {
    expect(resolveFrame({ yAxis: 'up' }, SIZE).yDir).toBe(-1);
    expect(resolveFrame({ yAxis: 'down' }, SIZE).yDir).toBe(1);
  });
});

/** Records the transform calls and reports where a world point lands, so the
 *  camera can be checked against `worldToScreen` without a real 2D context. */
function recordingCtx() {
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  return {
    translate(x: number, y: number) {
      m = { ...m, e: m.e + m.a * x + m.c * y, f: m.f + m.b * x + m.d * y };
    },
    scale(x: number, y: number) {
      m = { ...m, a: m.a * x, b: m.b * x, c: m.c * y, d: m.d * y };
    },
    project(p: { x: number; y: number }) {
      return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
    },
  };
}

describe('applyCamera', () => {
  const size = { width: 800, height: 600 };
  const view = { zoom: 1.5, pan: { x: 7, y: -3 } };
  const world = { x: 12, y: 34 };

  it('lands a world point where worldToScreen says, with no frame', () => {
    const ctx = recordingCtx();
    applyCamera(ctx as unknown as CanvasRenderingContext2D, view);
    const got = ctx.project(world);
    const want = worldToScreen(world, view);
    expect(got.x).toBeCloseTo(want.x, 10);
    expect(got.y).toBeCloseTo(want.y, 10);
  });

  it('lands a world point where worldToScreen says, in a centred y-up frame', () => {
    const frame = resolveFrame({ origin: { x: 0.5, y: 0.5 }, yAxis: 'up' }, size);
    const ctx = recordingCtx();
    applyCamera(ctx as unknown as CanvasRenderingContext2D, view, frame);
    const got = ctx.project(world);
    const want = worldToScreen(world, view, frame);
    expect(got.x).toBeCloseTo(want.x, 10);
    expect(got.y).toBeCloseTo(want.y, 10);
  });
});
