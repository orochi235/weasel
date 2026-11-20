import { describe, it, expect } from 'vitest';
import type { RenderLayer } from 'core/layers/render';
import { createDebugSink } from './createDebugSink';
import { beginDebugFrame } from './useDebugSink';

const layer = (id: string): RenderLayer<unknown> => ({ id, label: id, draw: () => [] });

describe('beginDebugFrame', () => {
  it('records the stack as painted: hidden layers dropped, in draw order, numbered by it', () => {
    const sink = createDebugSink({ layers: true });
    const layers = [layer('grid'), layer('selection'), layer('scene')];
    beginDebugFrame(sink, false, layers, { grid: false }, ['scene', 'grid', 'selection']);
    expect(sink.snapshot().layers.map((l) => [l.index, l.id])).toEqual([[0, 'scene'], [1, 'selection']]);
  });
});

describe('DebugFrame', () => {
  const stats = (id: string, drawCalls: number) =>
    ({ drawCalls, ms: 0, spans: [{ id, drawCalls, ms: 0 }], retained: { composited: 0, redrawn: 0, declined: 0, bytes: 0 } });

  it('records a paint cut across several renderers as one frame, bottom run first', () => {
    const sink = createDebugSink({ fps: true });
    const frame = beginDebugFrame(sink, true, [], {}, undefined)!;
    expect(frame.time()).toBeDefined();
    frame.end([
      { spans: [{ id: 'grid', start: 0, end: 1, buildMs: 0 }], render: stats('grid', 1) },
      { spans: [{ id: 'chrome', start: 0, end: 2, buildMs: 0 }], render: stats('chrome', 3) },
    ]);
    const recorded = sink.snapshot().frame!;
    expect(recorded.drawCalls).toBe(4);
    expect(recorded.layers.map((l) => [l.id, l.drawCalls])).toEqual([['grid', 1], ['chrome', 3]]);
  });

  it('records nothing for an untimed paint', () => {
    const sink = createDebugSink({ fps: true });
    const frame = beginDebugFrame(sink, true, [], {}, undefined)!;
    frame.end([{ spans: [], render: stats('a', 1) }]);
    expect(sink.snapshot().frame).toBeNull();
  });
});
