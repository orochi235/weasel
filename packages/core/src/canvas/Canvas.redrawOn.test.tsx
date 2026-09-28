/**
 * State a paint reads that lives outside React — a mode registry, a scoping
 * lookup — repaints the canvas by notifying, not by the consumer rebuilding a
 * prop. A layer declares its own source (`RenderLayer.subscribe`); anything
 * else the paint reads goes in `redrawOn`.
 *
 * The GL recorder is load-bearing: without it every paint bails early and the
 * draw counts below stay at zero whatever the canvas does.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { RenderLayer } from '../core/layers/render';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';
import { defineTool, useTools } from '../tools/overlayBinding';
import { WeaselProvider } from '../WeaselProvider';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function source() {
  const listeners = new Set<() => void>();
  return {
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    notify() { for (const l of [...listeners]) l(); },
    count: () => listeners.size,
  };
}

function probeLayer(draw: () => void, extra: Partial<RenderLayer<unknown>> = {}): RenderLayer<unknown> {
  return {
    id: 'probe',
    label: 'Probe',
    space: 'screen',
    draw: () => {
      draw();
      return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } }];
    },
    ...extra,
  };
}

describe('Canvas external redraw sources', () => {
  it("repaints when a layer's own subscription notifies", async () => {
    const draw = vi.fn();
    const src = source();
    const layers = { grid: null, probe: { layer: probeLayer(draw, { subscribe: src.subscribe }) } };
    render(<Canvas width={100} height={80} layers={layers} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { src.notify(); });
    await frame();

    expect(draw).toHaveBeenCalledTimes(2);
  });

  it("repaints when an active tool's overlay notifies, outside any React render", async () => {
    const draw = vi.fn();
    const src = source();
    const tool = defineTool({ id: 't', overlay: probeLayer(draw, { subscribe: src.subscribe }) });
    function Harness() {
      const tools = useTools({ active: 't', registry: { t: tool } });
      return <Canvas width={100} height={80} layers={{ grid: null }} tools={tools} />;
    }
    render(<WeaselProvider><Harness /></WeaselProvider>);
    await frame();
    const before = draw.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    act(() => { src.notify(); });
    await frame();

    expect(draw.mock.calls.length).toBe(before + 1);
  });

  it('repaints when a redrawOn source notifies', async () => {
    const draw = vi.fn();
    const src = source();
    const layers = { grid: null, probe: { layer: probeLayer(draw) } };
    const redrawOn = [src];
    render(<Canvas width={100} height={80} layers={layers} redrawOn={redrawOn} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { src.notify(); });
    await frame();

    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('keeps its subscriptions across renders that pass an equal inline array', () => {
    const src = source();
    const tracked = { subscribe: vi.fn(src.subscribe) };
    const layers = { grid: null, probe: { layer: probeLayer(() => {}) } };
    const { rerender } = render(<Canvas width={100} height={80} layers={layers} redrawOn={[tracked]} />);
    rerender(<Canvas width={100} height={80} layers={layers} redrawOn={[tracked]} />);
    expect(tracked.subscribe).toHaveBeenCalledTimes(1);
  });

  it('lets go of every subscription on unmount', async () => {
    const a = source();
    const b = source();
    const layers = { grid: null, probe: { layer: probeLayer(() => {}, { subscribe: a.subscribe }) } };
    const redrawOn = [b];
    const { unmount } = render(<Canvas width={100} height={80} layers={layers} redrawOn={redrawOn} />);
    expect(a.count()).toBe(1);
    expect(b.count()).toBe(1);
    unmount();
    expect(a.count()).toBe(0);
    expect(b.count()).toBe(0);
  });
});
