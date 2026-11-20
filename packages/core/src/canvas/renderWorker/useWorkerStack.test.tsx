import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Activity, useRef } from 'react';
import { createScene } from '../../core/scene/scene';
import type { RenderLayer } from '../../core/layers/render';
import { leaseCanvasRenderer } from '../canvasRenderer';
import { fakeWorker } from './testing/fakeWorker';
import { useWorkerStack } from './useWorkerStack';
import { WorkerCanvasStack } from './WorkerCanvasStack';
import type { CanvasWorkerSurface } from './workerStack';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const scene = createScene({ systemLayers: [{ id: 'main' }] });
const LAYERS = [{ id: 'scene:a' }, { id: 'page' }, { id: 'scene:b' }] as unknown as RenderLayer<unknown>[];
const lease = leaseCanvasRenderer();

let started: ReturnType<typeof fakeWorker>[];
let startWorker: () => Worker;
const transferred = new WeakSet<object>();
beforeEach(() => {
  started = [];
  startWorker = () => { const w = fakeWorker(); started.push(w); return w.worker; };
  (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen: () => unknown }).transferControlToOffscreen =
    function (this: object) {
      if (transferred.has(this)) throw new DOMException('already transferred', 'InvalidStateError');
      transferred.add(this);
      return {};
    };
});
afterEach(() => {
  delete (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen?: unknown }).transferControlToOffscreen;
});

function Stack({ start }: { start: () => Worker }) {
  const top = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef(VIEW);
  const surface = useRef<CanvasWorkerSurface>({
    start: () => start(),
    paints: (id) => id.startsWith('scene:'),
    inputs: () => ({ scene: scene as never }),
  }).current;
  const stack = useWorkerStack(surface, LAYERS, undefined, { canvas: top, lease }, {
    viewRef, dims: () => ({ width: 10, height: 10 }), requestRedraw: () => {},
  });
  return stack ? <WorkerCanvasStack stack={stack} top={<canvas ref={top} />} /> : null;
}

describe('useWorkerStack', () => {
  it('starts every worker again on new canvases when shown after its canvases went with their workers', async () => {
    const tree = (mode: 'visible' | 'hidden') => <Activity mode={mode}><Stack start={() => startWorker()} /></Activity>;
    const view = render(tree('visible'));
    expect(started).toHaveLength(2);
    view.rerender(tree('hidden'));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    for (const w of started) expect(w.terminate).toHaveBeenCalledTimes(1);
    view.rerender(tree('visible'));
    expect(started).toHaveLength(4);
    for (const w of started.slice(2)) expect(w.terminate).not.toHaveBeenCalled();
    view.unmount();
  });

  it('lets go of the workers it started when a later one fails to start', async () => {
    let calls = 0;
    const start = () => {
      if (++calls === 2) throw new Error('no worker');
      return startWorker();
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Stack start={start} />)).toThrow('no worker');
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(started).toHaveLength(1);
    expect(started[0]!.terminate).toHaveBeenCalledTimes(1);
    vi.mocked(console.error).mockRestore();
  });
});
