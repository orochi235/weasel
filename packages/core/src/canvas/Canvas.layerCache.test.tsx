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

describe('Canvas layer command cache', () => {
  it('reuses a deps-declaring layer\'s commands across paints', () => {
    const draw = vi.fn();
    const layer = makeLayer(draw, true);
    const { rerender } = render(
      <Canvas width={100} height={100} layers={{ grid: null, probe: { layer } }} />,
    );
    expect(draw).toHaveBeenCalledTimes(1);

    // A fresh layers-map object re-runs the paint effect with the same layer.
    rerender(<Canvas width={100} height={100} layers={{ grid: null, probe: { layer } }} />);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('still rebuilds a layer that declares no deps', () => {
    const draw = vi.fn();
    const layer = makeLayer(draw, false);
    const { rerender } = render(
      <Canvas width={100} height={100} layers={{ grid: null, probe: { layer } }} />,
    );
    expect(draw).toHaveBeenCalledTimes(1);

    rerender(<Canvas width={100} height={100} layers={{ grid: null, probe: { layer } }} />);
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
