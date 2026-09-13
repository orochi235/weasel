import { describe, expect, it } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import {
  createFakeAudioContext,
  type FakeGain, type FakePanner, type FakeSource,
} from './testing/fakeAudioContext';

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

function chainOf(source: FakeSource) {
  const panner = source.connectedTo[0] as FakePanner;
  return { panner, gain: panner.connectedTo[0] as FakeGain };
}

describe('createAudioEngine booking a voice already inside the window', () => {
  it('starts it at the end of the task, with no scheduler pass', async () => {
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    ctx._advance(40);
    engine.play(sound, { when: engine.now() });
    await endOfTask();
    expect(ctx._sources).toHaveLength(1);
    expect(ctx._sources[0].started[0]).toBeCloseTo(0.04, 6);
    expect(engine.activeVoices()).toBe(1);
  });

  it('starts a voice with no `when` without a pass', async () => {
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound);
    await endOfTask();
    expect(ctx._sources).toHaveLength(1);
  });

  it('leaves a voice beyond the window for a pass', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { when: 5000 });
    await endOfTask();
    expect(ctx._sources).toHaveLength(0);
    ctx._advance(4950);
    tick();
    expect(ctx._sources).toHaveLength(1);
  });

  it('is not booked a second time by the next pass', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { loop: true });
    await endOfTask();
    tick();
    tick();
    expect(ctx._sources).toHaveLength(1);
    expect(engine.activeVoices()).toBe(1);
  });

  it('plays a `when` already in the past now', async () => {
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    ctx._advance(500);
    const voice = engine.play(sound, { when: 100, loop: true });
    await endOfTask();
    expect(ctx._sources).toHaveLength(1);
    expect(voice.isPlaying()).toBe(true);
  });

  it('plays a past `when` booked after a suspension ended', async () => {
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    ctx._advance(200);
    ctx._setState('suspended');
    ctx._setState('running');
    const voice = engine.play(sound, { when: 100, loop: true });
    await endOfTask();
    expect(ctx._sources).toHaveLength(1);
    expect(voice.isPlaying()).toBe(true);
  });

  it('steals in `when` order, the same as a pass booking the same plays', async () => {
    const run = async (book: (tick: () => void) => Promise<void>) => {
      const { engine, tick } = engineHarness({ voiceLimit: 1 });
      await engine.unlock();
      const sound = await engine.load('/a.wav');
      const late = engine.play(sound, { when: 80, loop: true });
      const early = engine.play(sound, { when: 20, loop: true });
      await book(tick);
      return { late: late.isPlaying(), early: early.isPlaying() };
    };
    const onPass = await run(async (tick) => { tick(); });
    const atPlay = await run(endOfTask);
    expect(onPass).toEqual({ late: true, early: false });
    expect(atPlay).toEqual(onPass);
  });

  it('applies gain, pan, rate and detune set on the handle before it starts', async () => {
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { loop: true });
    voice.setGain(0.3);
    voice.setPan(-1);
    voice.setRate(2);
    voice.setDetune(-300);
    await endOfTask();
    const source = ctx._sources[0];
    const { gain, panner } = chainOf(source);
    expect(gain.gain.value).toBe(0.3);
    expect(panner.pan.value).toBe(-1);
    expect(source.playbackRate.value).toBe(2);
    expect(source.detune.value).toBe(-300);
  });

  it('does not sound a voice stopped in the same task it was played', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound).stop();
    engine.play(sound, { cancelKey: 'k' });
    engine.stopKey('k');
    await endOfTask();
    tick();
    expect(ctx._sources).toHaveLength(0);
    expect(engine.activeVoices()).toBe(0);
  });

  it('does not sound a voice played in the task that disposed the engine', async () => {
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound);
    engine.dispose();
    await endOfTask();
    expect(ctx._sources).toHaveLength(0);
  });
});
