import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Activity, Component, StrictMode, createRef, type ReactNode } from 'react';
import { createScene } from '../../core/scene/scene';
import { WorkerSceneView, type WorkerCanvasHandle } from './WorkerSceneView';
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

describe('<WorkerSceneView workerRef>', () => {
  it('says when its worker failed, and restarts on a new canvas with a new worker', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const started: ReturnType<typeof fakeWorker>[] = [];
    const start = () => { const w = fakeWorker(); started.push(w); return w.worker; };
    const handle = createRef<WorkerCanvasHandle>();
    const canvases: (HTMLCanvasElement | null)[] = [];
    render(<WorkerSceneView scene={scene} view={VIEW} width={10} height={10} worker={start} workerRef={handle}
      canvasRef={(el) => { if (el) canvases.push(el); }} />);
    const heard = vi.fn();
    handle.current!.subscribeStatus(heard);
    expect(handle.current!.status).toEqual({ state: 'starting' });
    act(() => started[0]!.fail('SyntaxError'));
    expect(handle.current!.status).toMatchObject({ state: 'failed', failure: { reason: 'startup' } });
    expect(heard).toHaveBeenCalled();
    expect(started[0]!.terminate).toHaveBeenCalledTimes(1);
    act(() => handle.current!.restart());
    expect(started).toHaveLength(2);
    expect(canvases).toHaveLength(2);
    expect(canvases[1]).not.toBe(canvases[0]);
    expect(handle.current!.status).toEqual({ state: 'starting' });
    heard.mockClear();
    act(() => started[1]!.answer({ type: 'ready' }));
    expect(handle.current!.status).toEqual({ state: 'running' });
    expect(heard).toHaveBeenCalledTimes(1);
    vi.mocked(console.warn).mockRestore();
  });
});

describe('<WorkerSceneView> hidden and shown again', () => {
  it('paints on a new canvas with a new worker once the one it kept went with its worker', async () => {
    const transferred = new WeakSet<object>();
    transfer = function (this: object) {
      if (transferred.has(this)) throw new DOMException('already transferred', 'InvalidStateError');
      transferred.add(this);
      return {};
    } as () => unknown;
    (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen: () => unknown }).transferControlToOffscreen =
      function (this: object) { return transfer.call(this); };
    const started: ReturnType<typeof fakeWorker>[] = [];
    const start = () => { const w = fakeWorker(); started.push(w); return w.worker; };
    const canvases: HTMLCanvasElement[] = [];
    const tree = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <WorkerSceneView scene={scene} view={VIEW} width={10} height={10} worker={start}
          canvasRef={(el) => { if (el && !canvases.includes(el)) canvases.push(el); }} />
      </Activity>
    );
    const view = render(tree('visible'));
    view.rerender(tree('hidden'));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(started[0]!.terminate).toHaveBeenCalledTimes(1);
    view.rerender(tree('visible'));
    expect(started).toHaveLength(2);
    expect(canvases).toHaveLength(2);
    expect(started[1]!.terminate).not.toHaveBeenCalled();
    view.unmount();
  });
});

describe('<WorkerSceneView redrawOn>', () => {
  it('sends the alphas an outside store changed when one of its sources notifies', async () => {
    const dimmed = createScene({ systemLayers: [{ id: 'main' }] });
    const id = dimmed.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 4, height: 4 }, data: {} });
    const w = fakeWorker();
    let dim = 1;
    const listeners = new Set<() => void>();
    const source = { subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; } };
    render(<WorkerSceneView scene={dimmed} view={VIEW} width={10} height={10} worker={() => w.worker}
      alphaFor={() => dim} redrawOn={[source]} />);
    await act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
    const sentAlpha = () => JSON.stringify(w.posted).includes(`["${id}",0.5]`);
    expect(sentAlpha()).toBe(false);
    await act(async () => {
      w.answer({ type: 'ready' });
      const first = w.posted.find((m) => m.type === 'frame') as { id: number };
      w.answer({ type: 'drawn', id: first.id });
      dim = 0.5;
      for (const fn of listeners) fn();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    });
    expect(sentAlpha()).toBe(true);
  });
});
