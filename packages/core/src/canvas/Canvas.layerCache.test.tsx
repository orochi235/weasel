/**
 * The layer command cache only pays for itself if it outlives a frame, so the
 * assertion is across two paints of the same mounted canvas.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { RenderLayer } from '../core/layers/render';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function makeLayer(draw: () => void, withDeps: boolean): RenderLayer<unknown> {
  return {
    id: 'probe',
    label: 'Probe',
    space: 'screen',
    ...(withDeps ? { deps: () => ['stable'] } : {}),
    draw: () => {
      draw();
      return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } }];
    },
  };
}

const waitForFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

describe('Canvas layer command cache', () => {
  it('reuses a deps-declaring layer\'s commands across paints', async () => {
    const draw = vi.fn();
    const layer = makeLayer(draw, true);
    const { rerender } = render(
      <Canvas width={100} height={100} layers={{ grid: null, probe: { layer } }} />,
    );
    await waitForFrame();
    expect(draw).toHaveBeenCalledTimes(1);

    // A fresh layers-map object marks the surface dirty with the same layer.
    rerender(<Canvas width={100} height={100} layers={{ grid: null, probe: { layer } }} />);
    await waitForFrame();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('still rebuilds a layer that declares no deps', async () => {
    const draw = vi.fn();
    const layer = makeLayer(draw, false);
    const { rerender } = render(
      <Canvas width={100} height={100} layers={{ grid: null, probe: { layer } }} />,
    );
    await waitForFrame();
    expect(draw).toHaveBeenCalledTimes(1);

    rerender(<Canvas width={100} height={100} layers={{ grid: null, probe: { layer } }} />);
    await waitForFrame();
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
