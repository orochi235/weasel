/** A tool definition replaced after mount reaches the canvas cursor. */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, render, cleanup } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import type { RenderLayer } from 'core/layers/render';
import type { SceneCanvasApi } from './canvasExtension';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { defineTool } from '../tools/overlayBinding';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

type D = { color: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});
afterEach(cleanup);

describe('SceneCanvas tool cursor', () => {
  it('follows a same-id tool definition that changes after mount', () => {
    function Harness({ cursor }: { cursor: string }) {
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      const tool = defineTool({ id: 'cursor', cursor });
      return (
        <SceneCanvas
          features={['draw']}
          scene={scene}
          width={200}
          height={200}
          layers={{}}
          tools={{ cursor: tool }}
          initialActiveTool="cursor"
        />
      );
    }
    const { container, rerender } = render(<Harness cursor="crosshair" />);
    const cursors = () =>
      [...container.querySelectorAll<HTMLElement>('*')]
        .map((el) => el.style.cursor)
        .filter(Boolean);
    expect(cursors()).toContain('crosshair');

    rerender(<Harness cursor="wait" />);
    expect(cursors()).toContain('wait');
    expect(cursors()).not.toContain('crosshair');
  });

  it('comes back after a hover cursor that overrode it is cleared', async () => {
    const claimLeftHalf: RenderLayer<unknown> = {
      id: 'left-half',
      label: 'Left half',
      draw: () => [],
      hitTest: (worldX) => (worldX < 100 ? { initialScratch: {}, cursor: 'nwse-resize' } : null),
    };
    function Harness() {
      const ref = useRef<SceneCanvasApi>(null);
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      useEffect(() => ref.current?.registerLayer(claimLeftHalf), []);
      return (
        <SceneCanvas
          ref={ref}
          scene={scene}
          width={200}
          height={200}
          layers={{}}
          tools={{ cursor: defineTool({ id: 'cursor', cursor: 'crosshair' }) }}
          initialActiveTool="cursor"
        />
      );
    }
    const { container } = render(<Harness />);
    await act(async () => {});
    const canvas = container.querySelector('canvas')!;
    const moveTo = (clientX: number) => act(async () => {
      const move = new Event('pointermove', { bubbles: true });
      Object.assign(move, { clientX, clientY: 10, pointerId: 1 });
      canvas.dispatchEvent(move);
    });
    expect(canvas.style.cursor).toBe('crosshair');

    await moveTo(10);
    expect(canvas.style.cursor).toBe('nwse-resize');

    await moveTo(150);
    expect(canvas.style.cursor).toBe('crosshair');
  });
});
