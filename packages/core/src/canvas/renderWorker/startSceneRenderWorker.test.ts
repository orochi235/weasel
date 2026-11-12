import { describe, expect, it, vi } from 'vitest';
import { createScene } from '../../core/scene/scene';
import { asNodeId, type RectPose } from '../../core/scene/types';
import { startSceneRenderWorker } from './startSceneRenderWorker';
import type { FromWorker, ToWorker } from './protocol';
import { answerImage } from './workerImages';

vi.mock('./workerImages', () => ({ answerImage: vi.fn() }));

/** A worker that records what the page posts and answers when told. */
function fakeWorker() {
  const posted: ToWorker[] = [];
  const listeners: ((e: MessageEvent<FromWorker>) => void)[] = [];
  const errors: ((e: ErrorEvent) => void)[] = [];
  const worker = {
    postMessage: (m: ToWorker) => { posted.push(m); },
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      if (type === 'message') listeners.push(fn);
      else if (type === 'error') errors.push(fn);
    },
    terminate: vi.fn(),
  };
  const answer = (data: FromWorker) => { for (const fn of listeners) fn({ data } as MessageEvent<FromWorker>); };
  const fail = () => { for (const fn of errors) fn({ message: 'boom' } as ErrorEvent); };
  return { worker: worker as unknown as Worker, posted, answer, fail, terminate: worker.terminate };
}

const canvas = () => ({ transferControlToOffscreen: () => ({}) }) as unknown as HTMLCanvasElement;
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
/** Every frame carries the page's time. */
const AT = { time: expect.any(Number) };

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
  it('answers what waits on a worker that never started, and what is asked of it after', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client, fail } = start();
    const rect = { x: 0, y: 0, width: 1, height: 1 };
    const waiting = client.readIds(rect);
    const shot = client.snapshot();
    fail();
    expect((await waiting).width).toBe(0);
    expect(await shot).toBeNull();
    expect((await client.readIds(rect)).width).toBe(0);
    warn.mockRestore();
  });

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
    expect(second).toEqual({ type: 'frame', at: AT, scene: { nodes: [expect.objectContaining({ id: 'a' })] } });
  });

  it('sends only the time when only the worker asked for a frame', () => {
    const { client, posted, answer } = start();
    client.sync();
    answer({ type: 'drawn' });
    answer({ type: 'dirty' });
    client.sync();
    expect(frames(posted)[1]).toEqual({ type: 'frame', at: AT });
  });

  it('stops the worker on dispose and syncs nothing after', () => {
    const { client, terminate, posted } = start();
    client.dispose();
    expect(terminate).toHaveBeenCalled();
    expect(client.sync()).toBe(false);
    expect(frames(posted)).toHaveLength(0);
  });
});

describe('startSceneRenderWorker, beside the scene', () => {
  it('sends scroll offsets when they change, and only the alphas that changed', () => {
    const { scene, client, posted, answer } = start();
    let dim = 1;
    client.update({ alphaFor: (id) => (id === 'a' ? dim : 1) });
    client.sync();
    expect(frames(posted)[0]).not.toHaveProperty('alpha');
    answer({ type: 'drawn' });
    dim = 0.25;
    scene.scroll.set(asNodeId('a'), { x: 4, y: 0 });
    client.sync();
    expect(frames(posted)[1]).toMatchObject({ alpha: [['a', 0.25]], scroll: [{ id: 'a', x: 4, y: 0 }] });
    answer({ type: 'drawn' });
    client.sync();
    expect(frames(posted)[2]).toEqual({ type: 'frame', at: AT });
  });
});

describe('startSceneRenderWorker, the worker animator', () => {
  it('sends animator calls and the frame time with the next frame, and a followed clock in its place', () => {
    const { scene, client, posted, answer } = start();
    const due = vi.fn();
    client.subscribe(due);
    const fade = client.animator.play('fade', { to: 1 });
    fade.setTimeScale(2);
    expect(due).toHaveBeenCalled();
    client.resumed();
    client.sync();
    const first = frames(posted)[0]!;
    expect(first).toMatchObject({
      at: { time: expect.any(Number) },
      resumed: true,
      animations: [{ op: 'play', id: fade.id, key: 'fade', params: { to: 1 } }, { op: 'scale', id: fade.id, scale: 2 }],
    });
    answer({ type: 'drawn' });
    const listeners: (() => void)[] = [];
    const clock = {
      clock: { elapsed: 250, rate: 0, subscribe: (fn: () => void) => { listeners.push(fn); return () => {}; } },
      onFrame: () => () => {},
    };
    client.update({ clock });
    due.mockClear();
    for (const fn of listeners) fn();
    expect(due).toHaveBeenCalled();
    client.sync();
    // The time the last frame stood at was on the page's timeline, not the clock's.
    expect(frames(posted)[1]).toEqual({ type: 'frame', at: { elapsed: 250, rate: 0 }, resumed: true });
    answer({ type: 'drawn' });
    // A seek made while the page's frames were away still plays.
    client.resumed();
    client.sync();
    expect(frames(posted).at(-1)).toEqual({ type: 'frame', at: { elapsed: 250, rate: 0 } });
    answer({ type: 'drawn' });
    client.update({ clock: undefined });
    client.sync();
    expect(frames(posted).at(-1)).toEqual({ type: 'frame', at: AT, resumed: true });
    void scene;
  });

  it('posts an image answer the page has at once, and stops a pending one on dispose', () => {
    const { client, posted, answer } = start();
    vi.mocked(answerImage).mockImplementationOnce((req, reply) => {
      reply({ type: 'image', id: req.id, src: req.src, error: 'gone' });
      return () => {};
    });
    answer({ type: 'image', id: 1, src: 'a.svg' });
    expect(posted.at(-1)).toEqual({ type: 'image', id: 1, src: 'a.svg', error: 'gone' });
    const stop = vi.fn();
    vi.mocked(answerImage).mockImplementationOnce(() => stop);
    answer({ type: 'image', id: 2, src: 'b.svg' });
    client.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('ignores what the worker says after dispose', () => {
    const { client, answer } = start();
    const due = vi.fn();
    client.subscribe(due);
    client.dispose();
    vi.mocked(answerImage).mockClear();
    answer({ type: 'image', id: 1, src: 'late.svg' });
    answer({ type: 'dirty' });
    client.animator.play('fade').cancel();
    expect(answerImage).not.toHaveBeenCalled();
    expect(due).not.toHaveBeenCalled();
  });

  it('watches no scene it is handed after dispose', () => {
    const { client } = start();
    const due = vi.fn();
    client.subscribe(due);
    client.dispose();
    const other = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    client.update({ scene: other });
    other.add({ id: asNodeId('b'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    expect(due).not.toHaveBeenCalled();
  });

  it('sends the whole frame again after one the worker could not be sent', () => {
    const { scene, client, posted, worker } = start();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const postMessage = worker.postMessage.bind(worker);
    worker.postMessage = (m: ToWorker) => {
      structuredClone(m);
      postMessage(m);
    };
    scene.update(asNodeId('a'), { data: { onTap: () => {} } });
    client.update({ extraCommands: [] });
    expect(client.sync()).toBe(true);
    expect(frames(posted)).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    scene.update(asNodeId('a'), { data: {} });
    client.sync();
    expect(frames(posted)[0]).toMatchObject({ scene: { reset: expect.anything() }, view: VIEW, extraCommands: [] });
    warn.mockRestore();
  });

  it('warns once for each different failure the worker reports, not once for its life', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { answer } = start();
    answer({ type: 'error', message: 'no animation registered as "a"' });
    answer({ type: 'error', message: 'no animation registered as "a"' });
    answer({ type: 'error', message: 'no animation registered as "b"' });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith(expect.any(String), 'no animation registered as "b"');
    warn.mockRestore();
  });
});
