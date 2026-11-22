import { describe, it, expect } from 'vitest';
import { Suspense, createElement, startTransition, type ReactNode } from 'react';
import { act, render, renderHook } from '@testing-library/react';
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

describe('useDebugSink with the URL config', () => {
  it('keeps its sink when an override lays a highlight over the URL config and then lifts it', () => {
    window.history.replaceState(null, '', '?debug=viewport');
    try {
      const { result, rerender } = renderHook(({ debug }: { debug: DebugFlags | undefined }) => useDebugSink(debug), {
        initialProps: { debug: undefined as DebugFlags | undefined },
      });
      const { sink } = result.current;
      expect(sink).not.toBeNull();
      rerender({ debug: { viewport: true, highlight: ['a'] } });
      expect(result.current.sink).toBe(sink);
      rerender({ debug: undefined });
      expect(result.current.sink).toBe(sink);
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });
});

describe('useDebugSink under a discarded render', () => {
  const never = new Promise<never>(() => {});
  const Stall = (): ReactNode => { throw never; };
  let sink: ReturnType<typeof useDebugSink>['sink'] = null;
  const Host = ({ highlight, stall }: { highlight: string[]; stall: boolean }): ReactNode => {
    sink = useDebugSink({ viewport: true, highlight }).sink;
    return stall ? createElement(Stall) : null;
  };
  const tree = (highlight: string[], stall: boolean) =>
    createElement(Suspense, { fallback: null }, createElement(Host, { highlight, stall }));

  it('keeps the committed highlight when a render with another one is thrown away', async () => {
    const { rerender } = render(tree(['a'], false));
    await act(async () => { startTransition(() => rerender(tree(['b'], true))); });
    await act(async () => { rerender(tree(['a'], false)); });
    sink!.recordBounds('a', { x: 0, y: 0, width: 1, height: 1 });
    sink!.recordBounds('b', { x: 0, y: 0, width: 1, height: 1 });
    expect(sink!.snapshot().bounds.map((b) => b.id)).toEqual(['a']);
  });
});
