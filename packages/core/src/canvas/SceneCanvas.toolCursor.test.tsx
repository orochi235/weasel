/** A tool definition replaced after mount reaches the canvas cursor. */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { defineTool } from '../tools/overlayBinding';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

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
      const tool = defineTool<null>({ id: 'cursor', cursor });
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
});
