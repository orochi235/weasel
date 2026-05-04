import { describe, it, expect, vi } from 'vitest';
import { createDebugOverlayLayer } from './createDebugOverlayLayer';
import { createDebugSink } from './createDebugSink';

function makeCtx() {
  const calls: string[] = [];
  const ctx = {
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push(`strokeRect(${x},${y},${w},${h})`)),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push(`fillRect(${x},${y},${w},${h})`)),
    beginPath: vi.fn(() => calls.push('beginPath')),
    arc: vi.fn(() => calls.push('arc')),
    fill: vi.fn(() => calls.push('fill')),
    stroke: vi.fn(() => calls.push('stroke')),
    moveTo: vi.fn(() => calls.push('moveTo')),
    lineTo: vi.fn(() => calls.push('lineTo')),
    setLineDash: vi.fn(),
    fillText: vi.fn((s: string, x: number, y: number) => calls.push(`fillText(${s},${x},${y})`)),
    measureText: vi.fn(() => ({ width: 50 })),
    canvas: { width: 200, height: 100 },
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    font: '',
    textBaseline: '' as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('createDebugOverlayLayer', () => {
  it('is registered as a screen-space layer', () => {
    const sink = createDebugSink({ bounds: true });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    expect(layer.space).toBe('screen');
    expect(layer.id).toBe('debug-overlay');
  });

  it('paints bounds when the bounds flag is on', () => {
    const sink = createDebugSink({ bounds: true });
    sink.recordBounds('a', { x: 10, y: 20, width: 30, height: 40 });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 0, y: 0, scale: 1 });
    expect(calls.some((c) => c.startsWith('strokeRect(10,20,30,40)'))).toBe(true);
  });

  it('paints bounds projected through view scale', () => {
    const sink = createDebugSink({ bounds: true });
    sink.recordBounds('a', { x: 10, y: 20, width: 30, height: 40 });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 5, y: 5, scale: 2 });
    expect(calls.some((c) => c.startsWith('strokeRect(10,30,60,80)'))).toBe(true);
  });

  it('paints origins as filled circles when origins flag is on', () => {
    const sink = createDebugSink({ origins: true });
    sink.recordOrigin('a', { x: 5, y: 5 });
    const layer = createDebugOverlayLayer({ sink, config: { origins: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 0, y: 0, scale: 1 });
    expect(calls).toContain('beginPath');
    expect(calls).toContain('arc');
    expect(calls).toContain('fill');
  });

  it('skips a feature when its config flag is off (no draws for that bucket)', () => {
    const sink = createDebugSink({ bounds: true, origins: true });
    sink.recordBounds('a', { x: 0, y: 0, width: 10, height: 10 });
    sink.recordOrigin('a', { x: 0, y: 0 });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 0, y: 0, scale: 1 });
    expect(calls.some((c) => c === 'arc')).toBe(false);
    expect(calls.some((c) => c.startsWith('strokeRect'))).toBe(true);
  });

  it('paints layer annotations when layers flag is on', () => {
    const sink = createDebugSink({ layers: true });
    sink.recordLayer('scene', 'Scene', 'world', 0);
    const layer = createDebugOverlayLayer({ sink, config: { layers: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 0, y: 0, scale: 1 });
    expect(calls.some((c) => c.startsWith('fillText('))).toBe(true);
  });
});
