import { describe, expect, it, vi } from 'vitest';
import { createScene } from '../../core/scene/scene';
import type { Scene } from '../../core/scene/types';
import { startSceneRenderWorker, type SceneRenderInputs } from './startSceneRenderWorker';
import { holdRenderWorker } from './liveClients';
import { countSubscriptions, fakeCanvas, fakeWorker } from './testing/fakeWorker';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function setup() {
  const scene = createScene({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;
  const subscriptions = countSubscriptions(scene);
  const inputs: SceneRenderInputs<unknown, string, unknown> = {
    scene, view: VIEW, width: 10, height: 10, dpr: 1,
    clock: { clock: { elapsed: 0, rate: 1, subscribe: () => { clockLive++; return () => { clockLive--; }; } }, onFrame: () => () => {} },
  };
  let clockLive = 0;
  return { scene, inputs, live: () => subscriptions() + clockLive, ...fakeWorker() };
}

describe('startSceneRenderWorker, when setup throws', () => {
  it('rethrows a failed transfer, and leaves nothing watching and no worker running', () => {
    const { inputs, worker, terminate, live } = setup();
    const error = new DOMException('already transferred', 'InvalidStateError');
    expect(() => startSceneRenderWorker(worker, fakeCanvas(error), inputs)).toThrow(error);
    expect(live()).toBe(0);
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('rethrows an init message that could not be posted, after the canvas went', () => {
    const { inputs, worker, terminate, live } = setup();
    const error = new DOMException('could not be cloned', 'DataCloneError');
    vi.mocked(worker.postMessage).mockImplementationOnce(() => { throw error; });
    expect(() => startSceneRenderWorker(worker, fakeCanvas(), inputs)).toThrow(error);
    expect(live()).toBe(0);
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('watches the scene once it is running, and stops on dispose', () => {
    const { inputs, worker, live } = setup();
    const client = startSceneRenderWorker(worker, fakeCanvas(), inputs);
    expect(live()).toBe(4);
    client.dispose();
    expect(live()).toBe(0);
  });
});

describe('holdRenderWorker, when setup throws', () => {
  it('passes on the error a worker constructor throws, and holds nothing for the canvas', () => {
    const { inputs, worker } = setup();
    const canvas = fakeCanvas();
    const error = new DOMException('blocked', 'SecurityError');
    expect(() => holdRenderWorker(canvas, () => { throw error; }, inputs)).toThrow(error);
    const held = holdRenderWorker(canvas, () => worker, inputs);
    expect(held.client.sync()).toBe(true);
    held.client.dispose();
  });

  it('terminates the worker it started when the canvas cannot be handed over', () => {
    const { inputs, worker, terminate } = setup();
    const error = new Error('no transfer');
    const canvas = fakeCanvas(error);
    expect(() => holdRenderWorker(canvas, () => worker, inputs)).toThrow(error);
    expect(terminate).toHaveBeenCalledTimes(1);
    const start = vi.fn(() => worker);
    expect(() => holdRenderWorker(canvas, start, inputs)).toThrow(error);
    expect(start).toHaveBeenCalledTimes(1);
  });
});
