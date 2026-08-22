import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';

const flush = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

function engineHarness() {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
  });
  return { ctx, engine, tick: () => pass?.() };
}

describe('engine.context', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is the injected context', () => {
    const { ctx, engine } = engineHarness();
    expect(engine.context as never).toBe(ctx);
  });

  it('is the context the engine created when none was injected', () => {
    const owned = createFakeAudioContext();
    vi.stubGlobal('AudioContext', function AudioContextStub() { return owned; });
    const engine = createAudioEngine({ setTimer: () => 1, clearTimer: () => {} });
    expect(engine.context as never).toBe(owned);
    engine.dispose();
  });

  it('builds a buffer that register() and play() then accept', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const buffer = engine.context.createBuffer(1, 128, engine.context.sampleRate);
    buffer.getChannelData(0)[0] = 0.5;
    const sound = engine.register(buffer);
    engine.play(sound);
    tick();
    expect(ctx._sources).toHaveLength(1);
    expect(ctx._sources[0].buffer).toBe(buffer);
  });

  it('stays readable after dispose, reporting a context the engine closed', async () => {
    const owned = createFakeAudioContext();
    vi.stubGlobal('AudioContext', function AudioContextStub() { return owned; });
    const engine = createAudioEngine({ setTimer: () => 1, clearTimer: () => {} });
    engine.dispose();
    await flush();
    expect(engine.context.state).toBe('closed');
  });

  it('is left open after dispose when the consumer injected it', async () => {
    const { engine } = engineHarness();
    engine.dispose();
    await flush();
    expect(engine.context.state).toBe('suspended');
  });
});
