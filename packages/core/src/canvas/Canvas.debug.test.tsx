/**
 * The debug overlay on `<Canvas>`: what the sink records of a frame, and that
 * the overlay layer lives as long as the mount does.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import type { CanvasDebugSink } from '../debug/types';
import type { RenderLayer } from 'core/layers/render';
import { WeaselRenderer } from '@weasel-js/renderer';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { vi.restoreAllMocks(); });

const waitForFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

/** Every string anywhere inside a frame's draw commands. */
function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsIn(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) stringsIn(v, out);
  return out;
}

const layer = (id: string): RenderLayer<unknown> => ({ id, label: id, draw: () => [] });

describe('<Canvas> debug overlay', () => {
  it('keeps its frame-rate window across a rebuild of the layer stack', async () => {
    const render_ = vi.spyOn(WeaselRenderer.prototype, 'render');
    const ref = createRef<CanvasExtensionApi>();
    render(<Canvas ref={ref} width={100} height={100} layers={{}} debug={{ fps: true }} />);
    for (let i = 0; i < 3; i++) {
      ref.current!.requestRedraw();
      await act(waitForFrame);
    }
    const fpsLine = (): string => {
      const commands = render_.mock.calls[render_.mock.calls.length - 1]![0];
      return stringsIn(commands).find((s) => s.startsWith('fps'))!;
    };
    expect(fpsLine()).toMatch(/\d/);

    await act(async () => { ref.current!.registerLayer(layer('late')); });
    await act(waitForFrame);
    expect(fpsLine()).toMatch(/\d/);
  });

  it('records each painted layer, bottom first, and not the overlay itself', async () => {
    const sinkRef = { current: null as CanvasDebugSink | null };
    render(
      <Canvas
        width={100}
        height={100}
        layers={{
          grid: { layer: layer('grid') },
          selectionOverlay: { layer: layer('selection-overlay') },
          mine: { layer: layer('mine') },
        }}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );
    await act(waitForFrame);
    await act(waitForFrame);
    const recorded = sinkRef.current!.snapshot().layers;
    expect(recorded.map((l) => l.id)).toEqual(['grid', 'selection-overlay', 'mine', 'painted-cursor']);
    expect(recorded.map((l) => l.index)).toEqual([0, 1, 2, 4]);
  });
});
