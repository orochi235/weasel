import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScene } from '../../core/scene/scene';
import type { Scene } from '../../core/scene/types';
import { startSceneRenderWorker } from './startSceneRenderWorker';
import type { RenderWorkerOptions } from './workerHealth';
import type { ToWorker } from './protocol';
import { countSubscriptions, fakeCanvas, fakeWorker } from './testing/fakeWorker';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const RECT = { x: 0, y: 0, width: 1, height: 1 };
const frames = (posted: ToWorker[]) => posted.filter((m): m is Extract<ToWorker, { type: 'frame' }> => m.type === 'frame');

function start(options: RenderWorkerOptions = { timeout: 1000 }) {
  const scene = createScene({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;
  const live = countSubscriptions(scene);
  const w = fakeWorker();
  const client = startSceneRenderWorker(w.worker, fakeCanvas(), { scene, view: VIEW, width: 10, height: 10, dpr: 1 }, options);
  const statusChanged = vi.fn();
  client.subscribeStatus(statusChanged);
  const lastFrame = () => frames(w.posted).at(-1)!;
  return { scene, client, live, statusChanged, lastFrame, ...w };
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockRestore(); vi.useRealTimers(); });

describe('a render worker that errs after it started', () => {
  it.each([
    ['raises an error', (w: ReturnType<typeof start>) => w.fail()],
    ['sends a message that cannot be read', (w: ReturnType<typeof start>) => w.garble()],
  ])('answers what waited as missing when it %s, and paints later frames', async (_, err) => {
    const w = start();
    w.answer({ type: 'ready' });
    w.client.sync();
    const lost = w.lastFrame();
    const shot = w.client.snapshot();
    const ids = w.client.readIds(RECT);
    const due = vi.fn();
    w.client.subscribe(due);
    err(w);
    expect(await shot).toBeNull();
    expect(await ids).toBeNull();
    expect(due).toHaveBeenCalled();
    expect(w.client.status).toEqual({ state: 'running' });
    expect(w.client.sync()).toBe(true);
    expect(w.lastFrame()).toMatchObject({ scene: { reset: expect.anything() } });
    // The lost frame's answer, arriving late, does not stand for the one now in flight.
    w.answer({ type: 'drawn', id: lost.id });
    w.client.sync();
    expect(frames(w.posted)).toHaveLength(2);
    w.answer({ type: 'drawn', id: w.lastFrame().id });
    w.client.sync();
    expect(frames(w.posted)).toHaveLength(3);
    expect(w.terminate).not.toHaveBeenCalled();
  });

  it('only warns of an error it reports and answered for', async () => {
    const w = start();
    w.answer({ type: 'ready' });
    const ids = w.client.readIds(RECT);
    w.answer({ type: 'error', message: 'no animation registered as "a"' });
    expect(w.client.status).toEqual({ state: 'running' });
    w.answer({ type: 'ids', id: 1, ids: null });
    expect(await ids).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('a render worker that fails for good', () => {
  it.each([
    ['its module never ran', 'startup', (w: ReturnType<typeof start>) => w.fail('SyntaxError')],
    ['it cannot open a context', 'init', (w: ReturnType<typeof start>) => w.answer({ type: 'error', message: 'no webgl2', fatal: true })],
  ])('when %s, says why, answers what waited, and lets go of the worker and the scene', async (_, reason, err) => {
    const w = start();
    w.client.sync();
    const shot = w.client.snapshot();
    err(w);
    expect(w.client.status).toEqual({ state: 'failed', failure: { reason, message: expect.any(String) } });
    expect(w.statusChanged).toHaveBeenCalledTimes(1);
    expect(await shot).toBeNull();
    expect(await w.client.readIds(RECT)).toBeNull();
    expect(w.terminate).toHaveBeenCalledTimes(1);
    expect(w.live()).toBe(0);
    expect(w.client.sync()).toBe(false);
    w.client.dispose();
    expect(w.terminate).toHaveBeenCalledTimes(1);
    expect(w.client.status.state).toBe('failed');
  });

  it('is ready once the worker says so', () => {
    const w = start();
    expect(w.client.status).toEqual({ state: 'starting' });
    w.answer({ type: 'ready' });
    expect(w.client.status).toEqual({ state: 'running' });
    expect(w.statusChanged).toHaveBeenCalledTimes(1);
  });
});

describe('a render worker that stops answering', () => {
  it('settles a request at the timeout, pings, and fails when the ping goes unanswered too', async () => {
    vi.useFakeTimers();
    const w = start();
    w.answer({ type: 'ready' });
    w.client.sync();
    const shot = w.client.snapshot();
    vi.advanceTimersByTime(1000);
    expect(await shot).toBeNull();
    const ping = w.posted.at(-1)!;
    expect(ping).toEqual({ type: 'ping', id: expect.any(Number) });
    // The lost frame's ack no longer holds frames back.
    expect(w.client.sync()).toBe(true);
    expect(frames(w.posted)).toHaveLength(2);
    expect(w.client.status.state).toBe('running');
    vi.advanceTimersByTime(1000);
    expect(w.client.status).toEqual({ state: 'failed', failure: { reason: 'unresponsive', message: expect.any(String) } });
    expect(w.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a busy worker that answers the ping', () => {
    vi.useFakeTimers();
    const w = start();
    w.answer({ type: 'ready' });
    void w.client.snapshot();
    vi.advanceTimersByTime(1000);
    const ping = w.posted.at(-1) as Extract<ToWorker, { type: 'ping' }>;
    w.answer({ type: 'pong', id: ping.id });
    vi.advanceTimersByTime(5000);
    expect(w.client.status.state).toBe('running');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits forever with an infinite timeout', () => {
    vi.useFakeTimers();
    const w = start({ timeout: Infinity });
    w.client.sync();
    void w.client.snapshot();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('disposing a render worker', () => {
  it('answers what waited, clears its timers, and says it is disposed', async () => {
    vi.useFakeTimers();
    const w = start();
    w.client.sync();
    const shot = w.client.snapshot();
    const ids = w.client.readIds(RECT);
    w.client.dispose();
    expect(await shot).toBeNull();
    expect(await ids).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(w.client.status).toEqual({ state: 'disposed' });
    expect(w.live()).toBe(0);
    w.fail();
    expect(w.client.status).toEqual({ state: 'disposed' });
  });
});
