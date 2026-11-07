import { describe, expect, it, vi } from 'vitest';
import { createScene } from '../../core/scene/scene';
import { asNodeId, type RectPose } from '../../core/scene/types';
import { startSceneRenderWorker } from './startSceneRenderWorker';
import type { FromWorker, ToWorker } from './protocol';

/** A worker that records what the page posts and answers when told. */
function fakeWorker() {
  const posted: ToWorker[] = [];
  const listeners: ((e: MessageEvent<FromWorker>) => void)[] = [];
  const worker = {
    postMessage: (m: ToWorker) => { posted.push(m); },
    addEventListener: (type: string, fn: (e: MessageEvent<FromWorker>) => void) => { if (type === 'message') listeners.push(fn); },
    terminate: vi.fn(),
  };
  const answer = (data: FromWorker) => { for (const fn of listeners) fn({ data } as MessageEvent<FromWorker>); };
  return { worker: worker as unknown as Worker, posted, answer, terminate: worker.terminate };
}

const canvas = () => ({ transferControlToOffscreen: () => ({}) }) as unknown as HTMLCanvasElement;
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function start() {
  const scene = createScene<object, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [{ id: asNodeId('a'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 5, height: 5 }, data: {} }],
  });
  const w = fakeWorker();
  const client = startSceneRenderWorker(w.worker, canvas(), { scene, view: VIEW, width: 10, height: 10, dpr: 1 });
  return { scene, client, ...w };
}

const frames = (posted: ToWorker[]) => posted.filter((m) => m.type === 'frame');

describe('startSceneRenderWorker', () => {
  it('hands the canvas over first, then sends a whole first frame', () => {
    const { client, posted } = start();
    expect(posted[0]).toMatchObject({ type: 'init', width: 10, height: 10, dpr: 1 });
    client.sync();
    expect(frames(posted)[0]).toMatchObject({ scene: { reset: expect.anything() }, view: VIEW, size: { width: 10, height: 10, dpr: 1 } });
  });

  it('holds a frame while one is in flight, and asks again once it lands', () => {
    const { scene, client, posted, answer } = start();
    const due = vi.fn();
    client.subscribe(due);
    client.sync();
    scene.setPose(asNodeId('a'), { x: 3, y: 0, width: 5, height: 5 });
    due.mockClear();
    client.sync();
    expect(frames(posted)).toHaveLength(1);
    answer({ type: 'drawn' });
    expect(due).toHaveBeenCalledTimes(1);
    client.sync();
    const second = frames(posted)[1]!;
    expect(second).toEqual({ type: 'frame', scene: { nodes: [expect.objectContaining({ id: 'a' })] } });
  });

  it('sends an empty frame when only the worker asked for one', () => {
    const { client, posted, answer } = start();
    client.sync();
    answer({ type: 'drawn' });
    answer({ type: 'dirty' });
    client.sync();
    expect(frames(posted)[1]).toEqual({ type: 'frame' });
  });

  it('stops the worker on dispose and syncs nothing after', () => {
    const { client, terminate, posted } = start();
    client.dispose();
    expect(terminate).toHaveBeenCalled();
    expect(client.sync()).toBe(false);
    expect(frames(posted)).toHaveLength(0);
  });
});
