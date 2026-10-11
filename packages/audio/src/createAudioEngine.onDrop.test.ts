import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';

function engineHarness(over: Record<string, unknown> = {}) {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
    ...over,
  });
  return { ctx, engine, tick: () => pass?.() };
}

const endOfTask = (): Promise<void> => Promise.resolve();

function callbacks() {
  const onDone = vi.fn();
  const onDrop = vi.fn();
  return { onDone, onDrop };
}

describe('a voice that never played', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('reports `locked` when the context is not running', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine } = engineHarness();
    const sound = await engine.load('/a.wav');
    const cb = callbacks();
    engine.play(sound, cb);
    // Not from inside `play()`: the caller does not have its handle yet.
    expect(cb.onDrop).not.toHaveBeenCalled();
    await endOfTask();
    expect(cb.onDrop.mock.calls).toEqual([['locked']]);
    expect(cb.onDone).not.toHaveBeenCalled();
  });

  it('reports `disposed` for a play after dispose, and for one still waiting at dispose', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const waiting = callbacks();
    engine.play(sound, { ...waiting, when: 5000 });
    engine.dispose();
    const after = callbacks();
    engine.playNote({ pitch: 440, ...after });
    await endOfTask();
    expect(waiting.onDrop.mock.calls).toEqual([['disposed']]);
    expect(after.onDrop.mock.calls).toEqual([['disposed']]);
    expect(waiting.onDone).not.toHaveBeenCalled();
  });

  it('reports `stopped` when it is stopped before it came due, by handle or by key', async () => {
    const { engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const byHandle = callbacks();
    const byKey = callbacks();
    const voice = engine.play(sound, { ...byHandle, when: 5000 });
    engine.playNoise({ noise: 'white', ...byKey, when: 5000, cancelKey: 'k' });
    voice.stop();
    voice.stop();
    engine.stopKey('k');
    tick();
    await endOfTask();
    expect(byHandle.onDrop.mock.calls).toEqual([['stopped']]);
    expect(byKey.onDrop.mock.calls).toEqual([['stopped']]);
    expect(byHandle.onDone).not.toHaveBeenCalled();
  });

  it('reports `unready` when its sound is not loaded in this engine', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const other = engineHarness();
    const foreign = await other.engine.load('/a.wav');
    const { engine, tick } = engineHarness();
    await engine.unlock();
    const cb = callbacks();
    engine.play(foreign, cb);
    tick();
    await endOfTask();
    expect(cb.onDrop.mock.calls).toEqual([['unready']]);
  });

  it('reports `failed` when its node throws as it starts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const createBufferSource = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = () => {
      const source = createBufferSource();
      source.start = () => { throw new RangeError('start time is negative'); };
      return source;
    };
    const cb = callbacks();
    engine.play(sound, cb);
    tick();
    await endOfTask();
    expect(cb.onDrop.mock.calls).toEqual([['failed']]);
    expect(cb.onDone).not.toHaveBeenCalled();
  });

  it('reports `stale` when it came due while the context was suspended', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const cb = callbacks();
    engine.play(sound, { ...cb, when: 500 });
    ctx._setState('suspended');
    ctx._advance(1000);
    ctx._setState('running');
    tick();
    await endOfTask();
    expect(cb.onDrop.mock.calls).toEqual([['stale']]);
  });
});

describe('a voice that played', () => {
  it('ends with `onDone` and no `onDrop`, however it was ended', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const stopped = callbacks();
    const voice = engine.play(sound, { ...stopped, loop: true });
    tick();
    voice.stop();
    ctx._advance(10);
    await endOfTask();
    expect(stopped.onDone).toHaveBeenCalledTimes(1);
    expect(stopped.onDrop).not.toHaveBeenCalled();
  });
});
