/**
 * The view has an imperative path: `setView` moves the camera and repaints
 * without a React render, `getView` reads the value the next paint will use,
 * and `subscribeView` feeds chrome that mirrors the camera.
 *
 * The GL recorder below is load-bearing — without a `getContext('webgl2')`
 * that answers like WebGL2, every paint bails early and every assertion about
 * painting passes vacuously.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Profiler, StrictMode } from 'react';
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
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

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

describe('imperative view', () => {
  it('setView updates getView and paints without a render', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    let commits = 0;
    render(
      <Profiler id="canvas" onRender={() => { commits++; }}>
        <Canvas
          ref={apiRef}
          width={100}
          height={80}
          layers={{ probe: { layer: probeLayer(draw) } }}
          defaultView={IDENTITY}
        />
      </Profiler>,
    );
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);
    const before = commits;

    const painted = vi.fn();
    apiRef.current!.subscribeFrame(painted);
    apiRef.current!.setView({ x: 40, y: 0, scale: { x: 2, y: 2 } });

    expect(apiRef.current!.getView()).toEqual({ x: 40, y: 0, scale: { x: 2, y: 2 } });
    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(2);
    expect(painted).toHaveBeenCalledTimes(1);
    expect(commits).toBe(before);
  });

  it('keeps setView, subscribeView and the repaint alive through a StrictMode remount', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    render(
      <StrictMode>
        <Canvas
          ref={apiRef}
          width={100}
          height={80}
          layers={{ probe: { layer: probeLayer(draw) } }}
          defaultView={IDENTITY}
        />
      </StrictMode>,
    );
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    const seen: number[] = [];
    apiRef.current!.subscribeView((v) => seen.push(v.x));
    apiRef.current!.setView({ x: 3, y: 0, scale: { x: 1, y: 1 } });

    expect(seen).toEqual([3]);
    expect(apiRef.current!.getView().x).toBe(3);
    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('setView accepts an updater and notifies subscribeView', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(<Canvas ref={apiRef} width={100} height={80} layers={{}} defaultView={IDENTITY} />);
    await frame();

    const seen: number[] = [];
    const stop = apiRef.current!.subscribeView((v) => seen.push(v.x));
    apiRef.current!.setView((cur) => ({ ...cur, x: cur.x + 10 }));
    apiRef.current!.setView((cur) => ({ ...cur, x: cur.x + 10 }));
    stop();
    apiRef.current!.setView((cur) => ({ ...cur, x: cur.x + 10 }));

    expect(seen).toEqual([10, 20]);
    expect(apiRef.current!.getView().x).toBe(30);
  });

  it('seeds the view from defaultView and clamps imperative writes to viewBounds', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(
      <Canvas
        ref={apiRef}
        width={100}
        height={80}
        layers={{}}
        defaultView={{ x: -10, y: -20, scale: { x: 1, y: 1 } }}
        viewBounds={{ x: 0, y: 0, width: 200, height: 160 }}
      />,
    );
    await frame();
    expect(apiRef.current!.getView()).toEqual({ x: -10, y: -20, scale: { x: 1, y: 1 } });

    apiRef.current!.setView({ x: -500, y: -500, scale: { x: 1, y: 1 } });
    // Panning past the bounds is clamped on the way in, not stored raw.
    expect(apiRef.current!.getView()).toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  });

  it('fires onViewChange for every imperative write', async () => {
    const onViewChange = vi.fn();
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(
      <Canvas
        ref={apiRef}
        width={100}
        height={80}
        layers={{}}
        defaultView={IDENTITY}
        onViewChange={onViewChange}
      />,
    );
    await frame();
    apiRef.current!.setView({ x: 5, y: 5, scale: { x: 1, y: 1 } });
    expect(onViewChange).toHaveBeenCalledWith({ x: 5, y: 5, scale: { x: 1, y: 1 } });
  });

  it('refuses setView while controlled, and says why', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onViewChange = vi.fn();
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(
      <Canvas
        ref={apiRef}
        width={100}
        height={80}
        layers={{}}
        view={IDENTITY}
        onViewChange={onViewChange}
      />,
    );
    await frame();

    apiRef.current!.setView({ x: 99, y: 0, scale: { x: 1, y: 1 } });

    expect(apiRef.current!.getView()).toEqual(IDENTITY);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('controlled'));
    // A refused write still reaches the owner of the prop, or the consumer
    // has no way to honor it.
    expect(onViewChange).toHaveBeenCalledWith({ x: 99, y: 0, scale: { x: 1, y: 1 } });
    warn.mockRestore();
  });

  it('tracks the view prop while controlled', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const { rerender } = render(
      <Canvas ref={apiRef} width={100} height={80} layers={{}} view={IDENTITY} />,
    );
    await frame();
    rerender(
      <Canvas
        ref={apiRef}
        width={100}
        height={80}
        layers={{}}
        view={{ x: 7, y: 8, scale: { x: 1, y: 1 } }}
      />,
    );
    expect(apiRef.current!.getView()).toEqual({ x: 7, y: 8, scale: { x: 1, y: 1 } });
  });

  it('repaints with the prop view a controlled consumer hands down', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    const draw = vi.fn();
    const layer = probeLayer(draw);
    const { rerender } = render(
      <Canvas ref={apiRef} width={100} height={80} layers={{ probe: { layer } }} view={IDENTITY} />,
    );
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    rerender(
      <Canvas
        ref={apiRef}
        width={100}
        height={80}
        layers={{ probe: { layer } }}
        view={{ x: 12, y: 0, scale: { x: 1, y: 1 } }}
      />,
    );
    await frame();
    await frame();
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
