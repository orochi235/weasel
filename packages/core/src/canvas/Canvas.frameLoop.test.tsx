/**
 * The paint runs on a frame loop, not on a React commit: many redraw requests
 * in one tick collapse into one paint, a paint costs no render, and an
 * unmounted canvas paints no more.
 *
 * The GL recorder below is load-bearing — without a `getContext('webgl2')`
 * that answers like WebGL2, every paint bails early and every assertion about
 * painting passes vacuously.
 */

import { describe, it, expect, beforeAll, afterEach, onTestFinished, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { Profiler, StrictMode, useLayoutEffect, useMemo } from 'react';
import type React from 'react';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import type { RenderLayer } from '../core/layers/render';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// No `deps`, so the command cache can't serve it: one call per paint.
function probeLayer(draw: () => void): RenderLayer<unknown> {
  return {
    id: 'probe',
    label: 'Probe',
    space: 'screen',
    draw: () => {
      draw();
      return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } }];
    },
  };
}

function Host({ apiRef, layer, width = 100 }: {
  apiRef: React.RefObject<CanvasExtensionApi | null>;
  layer: RenderLayer<unknown>;
  width?: number;
}) {
  return <Canvas ref={apiRef} width={width} height={80} layers={{ grid: null, probe: { layer } }} />;
}

describe('Canvas frame loop', () => {
  it('coalesces many requestRedraw calls in one tick into a single paint', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    render(<Host apiRef={apiRef} layer={probeLayer(draw)} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    const painted = vi.fn();
    apiRef.current!.subscribeFrame(painted);

    act(() => {
      apiRef.current!.requestRedraw();
      apiRef.current!.requestRedraw();
      apiRef.current!.requestRedraw();
    });
    await frame();
    await frame();

    expect(draw).toHaveBeenCalledTimes(2);
    expect(painted).toHaveBeenCalledTimes(1);
  });

  it('paints under StrictMode, whose simulated remount runs cleanup once', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    render(
      <StrictMode>
        <Host apiRef={apiRef} layer={probeLayer(draw)} />
      </StrictMode>,
    );
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { apiRef.current!.requestRedraw(); });
    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('hands out a requestRedraw whose identity survives re-renders', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const layer = probeLayer(vi.fn());
    const { rerender } = render(<Host apiRef={apiRef} layer={layer} />);
    await frame();
    const captured = apiRef.current!.requestRedraw;

    rerender(<Host apiRef={apiRef} layer={layer} width={140} />);
    await frame();

    // `@weasel-js/hud` and the gesture dispatcher capture this once and call
    // it for the life of the surface.
    expect(apiRef.current!.requestRedraw).toBe(captured);
  });

  it('schedules one more frame for a redraw issued from inside a draw', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn(() => {
      // Exactly one re-entrant request: a layer that redraws unconditionally
      // would spin the loop forever.
      if (draw.mock.calls.length === 2) apiRef.current!.requestRedraw();
    });
    render(<Host apiRef={apiRef} layer={probeLayer(draw)} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { apiRef.current!.requestRedraw(); });
    await frame();
    await frame();
    // The request made mid-draw survives the frame that was already running.
    expect(draw).toHaveBeenCalledTimes(3);

    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it('does not re-render to paint', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    let commits = 0;
    render(
      <Profiler id="canvas" onRender={() => { commits++; }}>
        <Host apiRef={apiRef} layer={probeLayer(draw)} />
      </Profiler>,
    );
    await frame();
    const before = commits;

    act(() => { apiRef.current!.requestRedraw(); });
    await frame();
    await frame();

    expect(draw).toHaveBeenCalledTimes(2);
    expect(commits).toBe(before);
  });

  it('notifies frame subscribers only when a paint actually landed', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const { unmount } = render(<Host apiRef={apiRef} layer={probeLayer(vi.fn())} />);
    await frame();

    const painted = vi.fn();
    apiRef.current!.subscribeFrame(painted);
    // The handle outlives the component — `@weasel-js/hud` holds one across an
    // async load, and `viewRegistry.attachSurface` hands it to the consumer.
    const api = apiRef.current!;
    unmount();

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    act(() => { api.requestRedraw(); });
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();

    await frame();
    await frame();
    expect(painted).not.toHaveBeenCalled();
  });

  it('notifies nobody for a frame that could not paint, and repaints later', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (...args: unknown[]) => unknown;
    };
    const working = proto.getContext;
    // Restored even when an assertion below throws: leaving a null-returning
    // getContext installed silently blanks every test that follows.
    onTestFinished(() => { proto.getContext = working; });
    proto.getContext = vi.fn(() => null);

    render(<Host apiRef={apiRef} layer={probeLayer(draw)} />);
    await frame();
    const painted = vi.fn();
    apiRef.current!.subscribeFrame(painted);
    act(() => { apiRef.current!.requestRedraw(); });
    await frame();
    await frame();

    expect(draw).not.toHaveBeenCalled();
    expect(painted).not.toHaveBeenCalled();

    proto.getContext = working;
    act(() => { apiRef.current!.requestRedraw(); });
    await frame();
    await frame();

    expect(draw).toHaveBeenCalledTimes(1);
    expect(painted).toHaveBeenCalledTimes(1);
  });

  it('cancels its pending frame on unmount', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const { unmount } = render(<Host apiRef={apiRef} layer={probeLayer(draw)} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    act(() => { apiRef.current!.requestRedraw(); });
    const pending = raf.mock.results[0]!.value as number;
    unmount();
    expect(cancel).toHaveBeenCalledWith(pending);
    raf.mockRestore();
    cancel.mockRestore();

    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('defers a redraw requested while the document is hidden, then paints on visibilitychange', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    render(<Host apiRef={apiRef} layer={probeLayer(draw)} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    const painted = vi.fn();
    apiRef.current!.subscribeFrame(painted);

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    onTestFinished(() => { hidden.mockRestore(); });
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    act(() => { apiRef.current!.requestRedraw(); });
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();

    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(painted).not.toHaveBeenCalled();

    hidden.mockRestore();
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await frame();
    await frame();

    // Hidden means deferred, not dropped: this paint is the request made while
    // the tab was in the background, not a fresh one.
    expect(draw).toHaveBeenCalledTimes(2);
    expect(painted).toHaveBeenCalledTimes(1);
  });

  it('schedules nothing on becoming visible when nothing asked for a redraw', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    render(<Host apiRef={apiRef} layer={probeLayer(draw)} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    // Every canvas on the page hears this event; a clean one must not cost a
    // frame for it.
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();

    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);
  });
});

// `layers` is memoized here on purpose: an object literal in JSX is a fresh
// identity every render, which requests a redraw by itself and would make a
// paint-timing assertion pass without reading the flag under test.
function SyncHost({ apiRef, layer, width = 100, syncPaint }: {
  apiRef: React.RefObject<CanvasExtensionApi | null>;
  layer: RenderLayer<unknown>;
  width?: number;
  syncPaint?: boolean;
}) {
  const layers = useMemo(() => ({ probe: { layer } }), [layer]);
  return (
    <Canvas ref={apiRef} width={width} height={80} layers={layers} syncPaint={syncPaint} />
  );
}

describe('Canvas syncPaint', () => {
  it('paints inside the commit, with no frame awaited', () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const layer = probeLayer(draw);
    const { rerender } = render(<SyncHost apiRef={apiRef} layer={layer} syncPaint />);
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { rerender(<SyncHost apiRef={apiRef} layer={layer} width={140} syncPaint />); });
    expect(draw).toHaveBeenCalledTimes(2);

    act(() => { apiRef.current!.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it('lands pixels before the surrounding layout effects read the DOM', () => {
    const order: string[] = [];
    const layer = probeLayer(() => { order.push('paint'); });
    function Wrapper() {
      const layers = useMemo(() => ({ probe: { layer } }), []);
      // A child's layout effects run before its parent's, so this is what
      // chrome pinned to canvas content sees when it measures.
      useLayoutEffect(() => { order.push('measure'); });
      return <Canvas width={100} height={80} layers={layers} syncPaint />;
    }
    render(<Wrapper />);

    expect(order).toEqual(['paint', 'measure']);
  });

  it('leaves the default painting on the frame, not the commit', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const layer = probeLayer(draw);
    render(<SyncHost apiRef={apiRef} layer={layer} />);
    expect(draw).not.toHaveBeenCalled();

    await frame();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('switches modes when syncPaint is toggled at runtime', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const layer = probeLayer(draw);
    const { rerender } = render(<SyncHost apiRef={apiRef} layer={layer} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    // Off to on: the commit that turns it on paints in that commit.
    act(() => { rerender(<SyncHost apiRef={apiRef} layer={layer} syncPaint />); });
    expect(draw).toHaveBeenCalledTimes(2);
    act(() => { apiRef.current!.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(3);

    // On to off: back on the frame loop.
    act(() => { rerender(<SyncHost apiRef={apiRef} layer={layer} />); });
    expect(draw).toHaveBeenCalledTimes(3);
    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(4);

    act(() => { apiRef.current!.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(4);
    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(5);
  });

  it('notifies nobody for a sync paint that could not paint, and repaints later', () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const layer = probeLayer(draw);
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (...args: unknown[]) => unknown;
    };
    const working = proto.getContext;
    onTestFinished(() => { proto.getContext = working; });
    proto.getContext = vi.fn(() => null);

    render(<SyncHost apiRef={apiRef} layer={layer} syncPaint />);
    const painted = vi.fn();
    apiRef.current!.subscribeFrame(painted);
    act(() => { apiRef.current!.requestRedraw(); });

    expect(draw).not.toHaveBeenCalled();
    expect(painted).not.toHaveBeenCalled();

    proto.getContext = working;
    act(() => { apiRef.current!.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(1);
    expect(painted).toHaveBeenCalledTimes(1);
  });

  it('defers a redraw requested from inside a draw to the next frame', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn(() => {
      // A synchronous flush from inside the paint would recurse forever.
      if (draw.mock.calls.length === 2) apiRef.current!.requestRedraw();
    });
    const layer = probeLayer(draw);
    render(<SyncHost apiRef={apiRef} layer={layer} syncPaint />);
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { apiRef.current!.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(2);

    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(3);

    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it('paints on every commit under StrictMode, remount simulation included', () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const layer = probeLayer(draw);
    render(
      <StrictMode>
        <SyncHost apiRef={apiRef} layer={layer} syncPaint />
      </StrictMode>,
    );
    // Once per commit, and StrictMode's simulated remount is a second one:
    // the loop has to be re-armed by then or that commit paints nothing.
    expect(draw).toHaveBeenCalledTimes(2);

    act(() => { apiRef.current!.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it('paints no more once unmounted', () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const { unmount } = render(<SyncHost apiRef={apiRef} layer={probeLayer(draw)} syncPaint />);
    expect(draw).toHaveBeenCalledTimes(1);

    const api = apiRef.current!;
    unmount();
    act(() => { api.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('holds a sync paint while the document is hidden and lands it on visibilitychange', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const layer = probeLayer(draw);
    const { rerender } = render(<SyncHost apiRef={apiRef} layer={layer} syncPaint />);
    expect(draw).toHaveBeenCalledTimes(1);

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    onTestFinished(() => { hidden.mockRestore(); });

    // A background tab still commits React updates, and a sync paint is the one
    // path the browser's own frame throttling does not stop.
    act(() => { rerender(<SyncHost apiRef={apiRef} layer={layer} width={140} syncPaint />); });
    expect(draw).toHaveBeenCalledTimes(1);
    act(() => { apiRef.current!.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(1);

    hidden.mockRestore();
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('drops a scheduled frame that a sync paint has already satisfied', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const layer = probeLayer(draw);
    const { rerender } = render(<SyncHost apiRef={apiRef} layer={layer} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { apiRef.current!.requestRedraw(); });
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { rerender(<SyncHost apiRef={apiRef} layer={layer} syncPaint />); });
    expect(draw).toHaveBeenCalledTimes(2);

    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
