import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Component, StrictMode, type ReactNode } from 'react';
import { createScene } from '../../core/scene/scene';
import { WorkerSceneView } from './WorkerSceneView';
import { fakeWorker } from './testing/fakeWorker';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const scene = createScene({ systemLayers: [{ id: 'main' }] });

class Boundary extends Component<{ children: ReactNode; onError: (e: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { this.props.onError(e); }
  render() { return this.state.failed ? null : this.props.children; }
}

let transfer: () => unknown;
beforeEach(() => {
  transfer = () => ({});
  (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen: () => unknown }).transferControlToOffscreen =
    function () { return transfer(); };
});
afterEach(() => {
  delete (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen?: unknown }).transferControlToOffscreen;
});

describe('<WorkerSceneView> under StrictMode', () => {
  it('starts one worker for the remount, and stops it a task after unmount', async () => {
    const w = fakeWorker();
    const start = vi.fn(() => w.worker);
    const view = render(<StrictMode><WorkerSceneView scene={scene} view={VIEW} width={10} height={10} worker={start} /></StrictMode>);
    expect(start).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });

  it('hands a failed transfer to the error boundary as thrown, with every worker it started stopped', () => {
    const error = new DOMException('already transferred', 'InvalidStateError');
    transfer = () => { throw error; };
    const started: ReturnType<typeof fakeWorker>[] = [];
    const start = () => { const w = fakeWorker(); started.push(w); return w.worker; };
    const onError = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StrictMode>
        <Boundary onError={onError}>
          <WorkerSceneView scene={scene} view={VIEW} width={10} height={10} worker={start} />
        </Boundary>
      </StrictMode>,
    );
    expect(onError).toHaveBeenCalledWith(error);
    expect(started.length).toBeGreaterThan(0);
    for (const w of started) expect(w.terminate).toHaveBeenCalledTimes(1);
    vi.mocked(console.error).mockRestore();
  });
});
