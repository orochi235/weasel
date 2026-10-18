import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { installFakeWorklet, type FakeWorklet } from './testing/fakeWorklet';
import type { AudioEngineOptions } from './types';
import type { ToProcessor } from './worklet/protocol';

let installed: FakeWorklet | null = null;
afterEach(() => { installed?.restore(); installed = null; });

async function harness(over: AudioEngineOptions = {}, { load = true } = {}) {
  const ctx = createFakeAudioContext();
  const worklet = installFakeWorklet(ctx);
  installed = worklet;
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    synthVoices: 'worklet',
    ...over,
  });
  if (load) worklet._load();
  await (load ? engine.unlock() : ctx.resume());
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  const run = async (ms: number) => {
    await flush();
    for (let t = 0; t < ms; t += 25) {
      ctx._advance(25);
      pass?.();
      await flush();
    }
  };
  const node = () => worklet.nodes[0];
  const posted = (kind: ToProcessor['kind']) => node().posted.filter((m) => m.kind === kind);
  return { ctx, engine, worklet, run, flush, node, posted };
}

describe("synthVoices: 'worklet'", () => {
  it('leaves the default on nodes, and makes no worklet node', async () => {
    const { ctx, engine, worklet, run } = await harness({ synthVoices: undefined });
    engine.playNote({ pitch: 440, duration: 50 });
    await run(25);
    expect(worklet.nodes).toHaveLength(0);
    expect(ctx._oscillators).toHaveLength(1);
  });

  it('posts a note when it is played, not when it comes due, at its level and pan', async () => {
    const { ctx, engine, node } = await harness();
    engine.playNote({ pitch: 'A4', when: 500, gain: 0.5, pan: -0.25, duration: 100, onDone: () => {} });
    expect(ctx._oscillators).toHaveLength(0);
    expect(node().name).toBe('weasel-voices');
    expect(node().posted).toEqual([{
      kind: 'note', id: 1, at: 0.5, level: 0.5, pan: -0.25, rate: 1, detune: 0,
      patch: { pitch: 'A4', wave: undefined, envelope: undefined, glide: undefined, filter: undefined, duration: 100 },
    }]);
  });

  it('runs one processor per bus, wired into that bus', async () => {
    const { engine, worklet } = await harness();
    engine.playNote({ pitch: 440 });
    engine.playNoise({ noise: 'white', bus: 'music' });
    engine.playNote({ pitch: 220, bus: 'music' });
    expect(worklet.nodes).toHaveLength(2);
    expect(worklet.nodes[1].posted.map((m) => m.kind)).toEqual(['noise', 'note']);
    expect(worklet.nodes[0].connectedTo[0]).not.toBe(worklet.nodes[1].connectedTo[0]);
  });

  it('seeds noise from the engine random', async () => {
    const { engine, posted } = await harness({ random: () => 0.75 });
    engine.playNoise({ noise: 'pink', duration: 50 });
    expect(posted('noise')[0]).toMatchObject({ seed: 0.75, patch: { noise: 'pink', duration: 50 } });
  });

  it('throws on a bad pitch at the call, as a node voice does', async () => {
    const { engine, worklet } = await harness();
    expect(() => engine.playNote({ pitch: 'H9' })).toThrow();
    expect(worklet.nodes).toHaveLength(0);
  });

  it('takes a pool slot when it comes due, and steals as a node voice does', async () => {
    const { engine, run, posted } = await harness({ voiceLimit: 1 });
    const first = engine.playNote({ pitch: 440 });
    engine.playNote({ pitch: 660, when: 200 });
    await run(25);
    expect(engine.activeVoices()).toBe(1);
    expect(posted('stop')).toEqual([]);
    await run(200);
    expect(engine.activeVoices()).toBe(1);
    expect(posted('stop')).toEqual([{ kind: 'stop', id: 1, at: 0 }]);
    expect(first.isPlaying()).toBe(false);
  });

  it('sends pan, position and gain as events', async () => {
    const { ctx, engine, run, posted } = await harness();
    const voice = engine.playNote({ pitch: 440, position: { x: 0, y: 0 } });
    await run(25);
    voice.setPan(0.5);
    voice.setGain(0.25, 100);
    voice.setPosition({ x: 400, y: 0 });
    expect(posted('pan')).toEqual([
      { kind: 'pan', id: 1, value: 0.5 },
      { kind: 'pan', id: 1, value: expect.any(Number) },
    ]);
    const pans = posted('pan');
    expect((pans[1] as { value: number }).value).toBeGreaterThan(0);
    const levels = posted('level') as { value: number; end: number }[];
    expect(levels[0]).toEqual({ kind: 'level', id: 1, value: 0.25, end: ctx.currentTime + 0.1 });
    // Moving keeps the ramp running to the same end.
    expect(levels[1].end).toBeCloseTo(ctx.currentTime + 0.1, 9);
  });

  it('reports no lateness for a worklet voice whose pass came late, as it was not', async () => {
    const onLate = vi.fn();
    const { ctx, engine, run } = await harness({ onLate });
    engine.playNote({ pitch: 440, when: 300, duration: 20 });
    engine.playNote({ pitch: 440, when: 300, duration: 20, bus: 'music' });
    ctx._advance(600);
    await run(25);
    expect(engine.activeVoices()).toBe(2);
    expect(onLate).not.toHaveBeenCalled();
  });

  it('retunes a voice booked for later', async () => {
    const { engine, posted } = await harness();
    engine.playNote({ pitch: 440, when: 1000 }).setDetune(100);
    expect(posted('retune')).toEqual([{ kind: 'retune', id: 1, rate: 1, detune: 100 }]);
  });

  it('fades out on stop(fadeMs) and ends when the processor says so', async () => {
    const { ctx, engine, run, node, posted } = await harness();
    const onDone = vi.fn();
    const voice = engine.playNote({ pitch: 440, onDone });
    await run(25);
    voice.stop(50);
    expect(posted('level').at(-1)).toEqual({ kind: 'level', id: 1, value: 0, end: ctx.currentTime + 0.05 });
    expect(posted('stop')).toEqual([{ kind: 'stop', id: 1, at: ctx.currentTime + 0.05 }]);
    expect(voice.isPlaying()).toBe(true);
    node()._ended(1);
    expect(voice.isPlaying()).toBe(false);
    expect(onDone).toHaveBeenCalledOnce();
    expect(engine.activeVoices()).toBe(0);
  });

  it('releases a sounding voice, and cancels one released before it comes due', async () => {
    const { engine, run, posted, flush } = await harness();
    const sounding = engine.playNote({ pitch: 440 });
    const onDrop = vi.fn();
    const later = engine.playNote({ pitch: 660, when: 1000, onDrop });
    await run(25);
    sounding.release();
    later.release();
    await flush();
    expect(posted('release')).toEqual([{ kind: 'release', id: 1 }]);
    expect(posted('stop')).toEqual([{ kind: 'stop', id: 2, at: 0 }]);
    expect(onDrop).toHaveBeenCalledWith('stopped');
  });

  it('ends a voice the processor finished before the scheduler reached it', async () => {
    const { engine, run, node, flush } = await harness();
    const onDone = vi.fn();
    const voice = engine.playNote({ pitch: 440, duration: 5, when: 150, onDone });
    node()._ended(1);
    await run(150);
    await flush();
    expect(onDone).toHaveBeenCalledOnce();
    expect(voice.isPlaying()).toBe(false);
    expect(engine.activeVoices()).toBe(0);
  });

  it('plays on nodes until the processor has loaded', async () => {
    const { ctx, engine, worklet, run } = await harness({}, { load: false });
    engine.playNote({ pitch: 440, duration: 50 });
    await run(25);
    expect(ctx._oscillators).toHaveLength(1);
    worklet._load();
    await engine.unlock();
    engine.playNote({ pitch: 440, duration: 50 });
    await run(25);
    expect(ctx._oscillators).toHaveLength(1);
    expect(worklet.nodes).toHaveLength(1);
  });

  it('stays on nodes, with a warning, when the processor fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx, engine, worklet, run } = await harness({}, { load: false });
    worklet._load(new Error('blocked'));
    await engine.unlock();
    engine.playNote({ pitch: 440, duration: 50 });
    await run(25);
    expect(ctx._oscillators).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('blocked'));
    warn.mockRestore();
  });

  it('tells the processor to stop on dispose, and unplugs it', async () => {
    const { engine, node, run } = await harness();
    engine.playNote({ pitch: 440 });
    await run(25);
    engine.dispose();
    expect(node().posted.slice(-2)).toEqual([{ kind: 'stop', id: 1, at: 0 }, { kind: 'dispose' }]);
    expect(node().disconnected).toBe(true);
  });
});
