import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RenderLayer } from 'core/layers/render';
import { createDebugSink } from './createDebugSink';
import { beginDebugFrame, useDebugSink } from './useDebugSink';
import type { DebugFlags } from './types';

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

describe('useDebugSink', () => {
  it('keeps its sink and what it holds when only highlight changes, recording the new ids', () => {
    const { result, rerender } = renderHook(({ debug }: { debug: DebugFlags }) => useDebugSink(debug), {
      initialProps: { debug: { viewport: true, highlight: ['a'] } },
    });
    const { sink, overlay } = result.current;
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    sink!.recordViewport('pan', view, view);
    rerender({ debug: { viewport: true, highlight: ['b'] } });
    expect(result.current.sink).toBe(sink);
    expect(sink!.snapshot().viewport).not.toBeNull();
    // A new overlay object, so the stack recomposes and repaints.
    expect(result.current.overlay).not.toBe(overlay);
    sink!.recordBounds('a', { x: 0, y: 0, width: 1, height: 1 });
    sink!.recordBounds('b', { x: 0, y: 0, width: 1, height: 1 });
    expect(sink!.snapshot().bounds.map((b) => b.id)).toEqual(['b']);
  });
});
