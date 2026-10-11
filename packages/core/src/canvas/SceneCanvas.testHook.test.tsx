/** `window.__weaselTest.getActiveToolId()` reads the live tool registry. */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { defineTool, type useTools } from '../tools/overlayBinding';
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
  window.history.replaceState(null, '', '/?test=1');
});
afterAll(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

function setup(initialActiveTool = 'alpha') {
  const alpha = defineTool<null>({ id: 'alpha', bindings: [] });
  const beta = defineTool<null>({ id: 'beta', bindings: [] });
  let tools: ReturnType<typeof useTools> | null = null;
  function Harness() {
    const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
    return (
      <SceneCanvas
        features={['draw']}
        scene={scene}
        width={200}
        height={200}
        layers={{}}
        tools={{ alpha, beta }}
        initialActiveTool={initialActiveTool}
        onToolsCreated={(t) => { tools = t; }}
      />
    );
  }
  const { unmount } = render(<Harness />);
  return { tools: () => tools!, unmount };
}

describe('SceneCanvas test hook', () => {
  it('getActiveToolId follows the tool registry', async () => {
    const { tools } = setup();
    const hook = window.__weaselTest!;
    await hook.ready;
    expect(hook.getActiveToolId()).toBe(tools().active);
    expect(hook.getActiveToolId()).not.toBeNull();

    act(() => { tools().setActive('beta'); });
    expect(hook.getActiveToolId()).toBe('beta');

    act(() => { tools().setActive(null); });
    expect(hook.getActiveToolId()).toBeNull();
  });

  it('answers for the canvas that replaced an unmounted one', async () => {
    const first = setup('alpha');
    await window.__weaselTest!.ready;
    first.unmount();
    expect(window.__weaselTest).toBeUndefined();

    setup('beta');
    await window.__weaselTest!.ready;
    expect(window.__weaselTest!.getActiveToolId()).toBe('beta');
  });

  it('stays with the first canvas while a second one mounts and unmounts beside it', async () => {
    setup('alpha');
    const hook = window.__weaselTest!;
    const second = setup('beta');
    expect(window.__weaselTest).toBe(hook);
    second.unmount();
    expect(window.__weaselTest).toBe(hook);
    expect(hook.getActiveToolId()).toBe('alpha');
  });
});
