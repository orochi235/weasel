/**
 * The paint runs on a frame loop, not on a React commit: many redraw requests
 * in one tick collapse into one paint, a paint costs no render, and an
 * unmounted canvas paints no more.
 *
 * The GL recorder below is load-bearing — without a `getContext('webgl2')`
 * that answers like WebGL2, every paint bails early and every assertion about
 * painting passes vacuously.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { Profiler, StrictMode } from 'react';
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
});
