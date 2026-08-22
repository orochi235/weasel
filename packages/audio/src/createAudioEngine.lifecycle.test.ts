import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext, type FakeNode } from './testing/fakeAudioContext';

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

const flush = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('createAudioEngine disposal', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('drops a play after dispose instead of building a silent zombie', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.dispose();
    const voice = engine.play(sound);
    tick();
    expect(voice.isPlaying()).toBe(false);
    expect(ctx._sources).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stops the voices that are still playing', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { loop: true });
    tick();
    engine.dispose();
    expect(voice.isPlaying()).toBe(false);
    expect(ctx._sources[0].stopped).toHaveLength(1);
    expect(engine.activeVoices()).toBe(0);
  });

  it('removes its gesture listeners', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { engine } = engineHarness();
    engine.dispose();
    expect(remove.mock.calls.map((c) => c[0]))
      .toEqual(expect.arrayContaining(['pointerdown', 'keydown', 'touchstart']));
    remove.mockRestore();
  });

  it('unsubscribes from a context it does not own', () => {
    const { ctx, engine } = engineHarness();
    expect(ctx._listenerCount()).toBe(1);
    engine.dispose();
    expect(ctx._listenerCount()).toBe(0);
  });

  it('does not resume a disposed engine', async () => {
    const { ctx, engine } = engineHarness();
    engine.dispose();
    await engine.unlock();
    expect(ctx.state).toBe('suspended');
  });

  it('unwires master from the destination, and only once', () => {
    const { ctx, engine } = engineHarness();
    expect(ctx.destination.connectedFrom).toHaveLength(1);
    engine.dispose();
    engine.dispose();
    expect(ctx.destination.connectedFrom).toEqual([]);
  });

  it('disposes the analyser taps it handed out', () => {
    const { engine } = engineHarness();
    const tap = engine.analyser('music');
    const node = tap.node as never as FakeNode;
    expect(node.connectedFrom).toHaveLength(1);
    engine.dispose();
    expect(node.connectedFrom).toEqual([]);
  });

  it('forgets a tap the consumer disposed', () => {
    const { engine } = engineHarness();
    const tap = engine.analyser();
    tap.dispose();
    expect(() => { engine.dispose(); }).not.toThrow();
  });

  it('closes a context it created, and leaves an injected one open', async () => {
    const owned = createFakeAudioContext();
    vi.stubGlobal('AudioContext', function AudioContextStub() { return owned; });
    const mine = createAudioEngine({ setTimer: () => 1, clearTimer: () => {} });
    mine.dispose();
    await flush();
    expect(owned.state).toBe('closed');

    const { ctx, engine } = engineHarness();
    engine.dispose();
    await flush();
    expect(ctx.state).toBe('suspended');
  });
});

describe('createAudioEngine re-suspension', () => {
  it('re-arms the gesture listener after the context suspends again', async () => {
    const { ctx, engine } = engineHarness();
    window.dispatchEvent(new Event('pointerdown'));   // consumes the one-shot arm
    await flush();
    expect(ctx.state).toBe('running');

    ctx._setState('suspended');                        // tab hidden
    window.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(ctx.state).toBe('running');
    engine.dispose();
  });

  it('warns again for a play dropped in a new suspension episode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx, engine } = engineHarness();
    const sound = await engine.load('/a.wav');
    engine.play(sound);                                // locked: warns once
    expect(warn).toHaveBeenCalledTimes(1);
    await engine.unlock();
    ctx._setState('suspended');
    engine.play(sound);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('drops entries that came due while suspended, and keeps the later ones', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const stale = engine.play(sound, { when: 100, loop: true });
    const later = engine.play(sound, { when: 5000, loop: true });
    ctx._advance(200);          // the timer is starved; the clock is not
    ctx._setState('suspended');
    ctx._setState('running');
    tick();
    expect(ctx._sources).toHaveLength(0);
    expect(stale.isPlaying()).toBe(false);
    ctx._advance(5000);
    tick();
    expect(ctx._sources).toHaveLength(1);
    expect(later.isPlaying()).toBe(true);
  });

  it('stops listening to the context once disposed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    engine.dispose();
    ctx._setState('suspended');
    window.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(ctx.state).toBe('suspended');
    warn.mockRestore();
  });
});
