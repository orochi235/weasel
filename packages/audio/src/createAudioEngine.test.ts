import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import {
  createFakeAudioContext,
  type FakeGain, type FakeNode, type FakePanner, type FakeSource,
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

/** source → panner → gain → bus, the chain `play()` builds. */
function chainOf(source: FakeSource) {
  const panner = source.connectedTo[0] as FakePanner;
  const gain = panner.connectedTo[0] as FakeGain;
  return { panner, gain, bus: gain.connectedTo[0] as FakeGain };
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
    warn.mockRestore();
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

  it('reports engine time in ms from the audio clock in seconds', () => {
    const { ctx, engine } = engineHarness();
    ctx._advance(250);
    expect(engine.now()).toBeCloseTo(250, 6);
  });

  it('routes a voice through its own gain and panner into its bus', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { bus: 'music', gain: 0.5, pan: -1 });
    tick();
    const { panner, gain, bus } = chainOf(ctx._sources[0]);
    expect(panner.kind).toBe('panner');
    expect(panner.pan.value).toBe(-1);
    expect(gain.kind).toBe('gain');
    expect(gain.gain.value).toBe(0.5);
    // The bus node, which the graph wires to master.
    expect(bus.connectedTo.map((n: FakeNode) => n.kind)).toEqual(['gain']);
  });

  it('applies the play-time rate and detune to the source', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { rate: 1.5, detune: 700, loop: true });
    tick();
    const source = ctx._sources[0];
    expect(source.playbackRate.value).toBe(1.5);
    expect(source.detune.value).toBe(700);
    expect(source.loop).toBe(true);
    expect(source.buffer).not.toBeNull();
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

  it('drops a queued voice stopped through its handle, with no cancel key', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { when: 10_000 });
    voice.stop();
    ctx._advance(10_000);
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
    expect(chainOf(ctx._sources[0]).panner.pan.value).toBeCloseTo(0.5, 6);
  });

  it('moves playing voices when the listener moves', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    engine.setListener({ x: 0, y: 0 });
    const sound = await engine.load('/a.wav');
    engine.play(sound, { position: { x: 250, y: 0 }, loop: true });
    tick();
    const { panner, gain } = chainOf(ctx._sources[0]);
    expect(panner.pan.value).toBeCloseTo(0.5, 6);
    engine.setListener({ x: 500, y: 0 });
    expect(panner.pan.value).toBeCloseTo(-0.5, 6);
    expect(gain.gain.value).toBeCloseTo(1 / 250, 6);
  });

  it('takes new spatial options with the listener', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { position: { x: 250, y: 0 }, loop: true });
    tick();
    engine.setListener({ x: 0, y: 0 }, { panWidth: 250 });
    expect(chainOf(ctx._sources[0]).panner.pan.value).toBeCloseTo(1, 6);
  });

  it('stops re-spatializing a voice once it has ended', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { position: { x: 250, y: 0 } });
    tick();
    const { gain } = chainOf(ctx._sources[0]);
    ctx._advance(1000);   // the buffer runs out
    const writes = gain.gain.holds.length;
    engine.setListener({ x: 9000, y: 0 });
    expect(gain.gain.holds).toHaveLength(writes);
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

  it('stops the stolen voice at the source, not just in the bookkeeping', async () => {
    const { ctx, engine, tick } = engineHarness({ voiceLimit: 1 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { loop: true });
    tick();
    const victim = ctx._sources[0];
    engine.play(sound, { loop: true });
    tick();
    expect(victim.stopped).toHaveLength(1);
    expect(victim.connectedTo).toEqual([]);
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
    expect(engine.activeVoices('sfx')).toBe(2);
  });

  it('limits per bus, so one bus cannot starve another', async () => {
    const { engine, tick } = engineHarness({ voiceLimit: 1 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const music = engine.play(sound, { bus: 'music', loop: true });
    tick();
    const sfx = engine.play(sound, { bus: 'sfx', loop: true });
    tick();
    engine.play(sound, { bus: 'sfx', loop: true });   // steals within sfx only
    tick();
    expect(sfx.isPlaying()).toBe(false);
    expect(music.isPlaying()).toBe(true);
    expect(engine.activeVoices('music')).toBe(1);
    expect(engine.activeVoices('sfx')).toBe(1);
    expect(engine.activeVoices()).toBe(2);
  });

  it('releases the slot when a one-shot reaches the end of its buffer', async () => {
    const { ctx, engine, tick } = engineHarness({ voiceLimit: 1 });
    const done = vi.fn();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { onDone: done });
    tick();
    expect(engine.activeVoices('sfx')).toBe(1);
    ctx._advance(1000);   // the fake buffer is one second long
    expect(voice.isPlaying()).toBe(false);
    expect(engine.activeVoices('sfx')).toBe(0);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('holds no slot while a voice is only booked, so booking ahead evicts nothing', async () => {
    const { engine, tick } = engineHarness({ voiceLimit: 1 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const playing = engine.play(sound, { loop: true });
    tick();
    engine.play(sound, { when: 60_000, loop: true });
    tick();
    expect(engine.activeVoices('sfx')).toBe(1);
    expect(playing.isPlaying()).toBe(true);
  });

  it('unwires the whole chain when a voice stops', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { loop: true });
    tick();
    const source = ctx._sources[0];
    const { panner, gain } = chainOf(source);
    voice.stop();
    expect(source.stopped).toHaveLength(1);
    expect(source.connectedTo).toEqual([]);
    expect(panner.connectedTo).toEqual([]);
    expect(gain.connectedTo).toEqual([]);
  });

  it('fades a voice out over fadeMs instead of cutting it', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { loop: true });
    tick();
    const source = ctx._sources[0];
    const { gain } = chainOf(source);
    ctx._advance(500);
    voice.stop(200);
    expect(gain.gain.ramps).toEqual([{ value: 0, at: 0.7 }]);
    expect(source.stopped).toEqual([0.7]);
    expect(voice.isPlaying()).toBe(true);
    ctx._advance(200);
    expect(voice.isPlaying()).toBe(false);
    expect(engine.activeVoices()).toBe(0);
  });

  it('ramps a voice gain instead of jumping to it', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { loop: true });
    tick();
    const { gain } = chainOf(ctx._sources[0]);
    voice.setGain(0.5, 200);
    expect(gain.gain.ramps).toEqual([{ value: 0.5, at: 0.2 }]);
    expect(gain.gain.value).toBe(1);
  });

  it('applies a rate and detune set before a booked voice starts', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound, { when: 5000, loop: true });
    voice.setRate(2);
    voice.setDetune(-300);
    ctx._advance(5000);
    tick();
    expect(ctx._sources[0].playbackRate.value).toBe(2);
    expect(ctx._sources[0].detune.value).toBe(-300);
  });

  it('leaves a source alone once the voice has ended', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound);
    tick();
    const source = ctx._sources[0];
    ctx._advance(1000);
    voice.setRate(3);
    voice.setDetune(1200);
    expect(source.playbackRate.value).toBe(1);
    expect(source.detune.value).toBe(0);
  });

  it('warns and drops a sound handle this engine never loaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const voice = engine.play({ id: 'snd_elsewhere' });
    tick();
    expect(ctx._sources).toHaveLength(0);
    expect(voice.isPlaying()).toBe(false);
    expect(warn.mock.calls[0][0]).toContain('snd_elsewhere');
    warn.mockRestore();
  });

  it('stops everything on stopAll', async () => {
    const { engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true });
    tick();
    engine.stopAll();
    expect(a.isPlaying()).toBe(false);
    expect(engine.activeVoices()).toBe(0);
  });

  it('reports its bus names, first one first', () => {
    const { engine } = engineHarness({ buses: ['master-ish', 'music'] });
    expect(engine.busNames()).toEqual(['master-ish', 'music']);
  });

  it('plays on the first configured bus by default', async () => {
    const { ctx, engine, tick } = engineHarness({ buses: ['only'] });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { loop: true });
    tick();
    expect(engine.activeVoices('only')).toBe(1);
    // The bus node, wired on to master by the graph.
    expect(chainOf(ctx._sources[0]).bus.connectedTo).toHaveLength(1);
  });

  it('refuses an engine with no buses at all', () => {
    expect(() => engineHarness({ buses: [] })).toThrow(/at least one bus/);
  });

  it('throws for an unknown bus name', async () => {
    const { engine } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    expect(() => engine.play(sound, { bus: 'nope' })).toThrow(/nope/);
  });
});
