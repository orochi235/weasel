import { describe, expect, it, vi } from 'vitest';
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

describe('createAudioEngine', () => {
  it('reports the suspended state before unlock', () => {
    const { engine } = engineHarness();
    expect(engine.state()).toBe('suspended');
  });

  it('resumes the context on unlock', async () => {
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    expect(ctx.state).toBe('running');
    expect(engine.state()).toBe('running');
  });

  it('drops a play before unlock and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx, engine } = engineHarness();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound);
    expect(voice.isPlaying()).toBe(false);
    expect(ctx._sources).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  it('starts a source once unlocked and the scheduler passes', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound);
    tick();
    expect(ctx._sources).toHaveLength(1);
  });

  it('starts the source at the requested engine time, not at now', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { when: 50 });
    tick();
    // Engine ms → Web Audio seconds.
    expect(ctx._sources[0].started[0]).toBeCloseTo(0.05, 6);
  });

  it('reports engine time in ms from the audio clock in seconds', async () => {
    const { ctx, engine } = engineHarness();
    ctx._advance(250);
    expect(engine.now()).toBeCloseTo(250, 6);
  });

  it('routes a voice through its bus', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { bus: 'music' });
    tick();
    const source = ctx._sources[0] as never as { connectedTo: { kind: string }[] };
    expect(source.connectedTo[0].kind).toBe('panner');
  });

  it('stops every voice sharing a cancel key', async () => {
    const { engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { cancelKey: 'steps' });
    const b = engine.play(sound, { cancelKey: 'steps' });
    tick();
    engine.stopKey('steps');
    expect(a.isPlaying()).toBe(false);
    expect(b.isPlaying()).toBe(false);
  });

  it('cancels a voice scheduled but not yet started', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { when: 10_000, cancelKey: 'late' });
    engine.stopKey('late');
    tick();
    expect(ctx._sources).toHaveLength(0);
  });

  it('applies spatialized pan from a position and the listener', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    engine.setListener({ x: 0, y: 0 });
    const sound = await engine.load('/a.wav');
    engine.play(sound, { position: { x: 250, y: 0 } });
    tick();
    const panner = ctx._sources[0].connectedTo[0] as never as { pan: { value: number } };
    expect(panner.pan.value).toBeCloseTo(0.5, 6);
  });

  it('steals the oldest voice past the limit', async () => {
    const { engine, tick } = engineHarness({ voiceLimit: 2 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true });
    engine.play(sound, { loop: true });
    tick();
    engine.play(sound, { loop: true });
    tick();
    expect(a.isPlaying()).toBe(false);
  });

  it('does not hand the same slot to two live voices after a steal', async () => {
    const { engine, tick } = engineHarness({ voiceLimit: 2 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { loop: true });
    engine.play(sound, { loop: true });
    tick();
    const c = engine.play(sound, { loop: true });   // steals
    const d = engine.play(sound, { loop: true });   // steals again
    tick();
    expect(c.isPlaying()).toBe(true);
    expect(d.isPlaying()).toBe(true);
  });

  it('limits per bus, so one bus cannot starve another', async () => {
    const { engine, tick } = engineHarness({ voiceLimit: 1 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const music = engine.play(sound, { bus: 'music', loop: true });
    tick();
    engine.play(sound, { bus: 'sfx', loop: true });
    engine.play(sound, { bus: 'sfx', loop: true });   // steals within sfx only
    tick();
    expect(music.isPlaying()).toBe(true);
  });

  it('stops everything on stopAll', async () => {
    const { engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true });
    tick();
    engine.stopAll();
    expect(a.isPlaying()).toBe(false);
  });
});
