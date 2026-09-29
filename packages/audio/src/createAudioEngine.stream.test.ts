import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import {
  createFakeAudioContext, createFakeMediaElement,
  type FakeGain, type FakeMediaElement, type FakeMediaSource, type FakeNode, type FakePanner,
} from './testing/fakeAudioContext';
import { allPaths } from './testing/graphWalk';

async function harness(over: Record<string, unknown> = {}) {
  const ctx = createFakeAudioContext();
  const sources: FakeMediaSource[] = [];
  const create = ctx.createMediaElementSource.bind(ctx);
  ctx.createMediaElementSource = (el) => {
    const s = create(el);
    sources.push(s);
    return s;
  };
  const timers = new Map<number, () => void>();
  let id = 0;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb: () => void) => { id += 1; timers.set(id, cb); return id; },
    clearTimer: (h: unknown) => { timers.delete(h as number); },
    ...over,
  });
  await engine.unlock();
  /** One round of every pending timer: a scheduler pass, plus any fade. */
  const tick = (): void => {
    const due = [...timers.values()];
    timers.clear();
    for (const f of due) f();
  };
  return { ctx, engine, sources, tick };
}

const flush = () => new Promise<void>((r) => { setTimeout(r, 0); });

function chainOf(source: FakeNode) {
  const panner = source.connectedTo[0] as FakePanner;
  const gain = panner.connectedTo[0] as FakeGain;
  return { panner, gain, bus: gain.connectedTo[0] };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('engine.stream', () => {
  it('routes an element through a media source, a voice chain and the bus input', async () => {
    const { engine, sources, tick } = await harness();
    const el = createFakeMediaElement('/theme.ogg');
    const voice = engine.stream(el as never, { bus: 'music', gain: 0.5 });
    tick();
    expect(sources).toHaveLength(1);
    expect(chainOf(sources[0]).gain.gain.value).toBe(0.5);
    expect(el.paused).toBe(false);
    expect(voice.isPlaying()).toBe(true);
    expect(engine.activeVoices('music')).toBe(1);
  });

  it('connects to the bus input, ahead of its inserts', async () => {
    const { ctx, engine, sources, tick } = await harness();
    engine.stream(createFakeMediaElement() as never, { bus: 'music' });
    tick();
    // input → (empty insert chain's link) → fader → master → destination.
    const routes = allPaths(chainOf(sources[0]).bus, ctx.destination);
    expect(routes.map((r) => r.length)).toEqual([5]);
  });

  it('opens a URL as a new media element', async () => {
    const made: FakeMediaElement[] = [];
    vi.stubGlobal('Audio', function Audio() {
      const el = createFakeMediaElement();
      made.push(el);
      return el;
    });
    const { engine, tick } = await harness();
    engine.stream('/long.mp3', { crossOrigin: 'anonymous' });
    tick();
    expect(made.map((e) => [e.src, e.crossOrigin, e.paused])).toEqual([['/long.mp3', 'anonymous', false]]);
  });

  it('reuses the one source node an element can have, stopping the earlier voice', async () => {
    const { engine, sources, tick } = await harness();
    const el = createFakeMediaElement();
    const first = engine.stream(el as never);
    tick();
    const second = engine.stream(el as never);
    tick();
    expect(sources).toHaveLength(1);
    expect(first.isPlaying()).toBe(false);
    expect(second.isPlaying()).toBe(true);
    expect(sources[0].connectedTo).toHaveLength(1);
  });

  it('pauses and unwires on stop', async () => {
    const { engine, sources, tick } = await harness();
    const el = createFakeMediaElement();
    const voice = engine.stream(el as never);
    tick();
    voice.stop();
    expect(el.paused).toBe(true);
    expect(sources[0].connectedTo).toEqual([]);
    expect(voice.isPlaying()).toBe(false);
  });

  it('fades out on the audio clock before pausing', async () => {
    const { ctx, engine, sources, tick } = await harness();
    const el = createFakeMediaElement();
    const onDone = vi.fn();
    const voice = engine.stream(el as never, { onDone });
    tick();
    const { gain } = chainOf(sources[0]);
    voice.stop(200);
    expect(gain.gain.ramps.at(-1)).toEqual({ value: 0, at: 0.2 });
    tick();
    expect(el.paused).toBe(false);
    ctx._advance(200);
    tick();
    expect(el.paused).toBe(true);
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(voice.isPlaying()).toBe(false);
  });

  it('ends when the element does, and calls onDone', async () => {
    const { engine, tick } = await harness();
    const el = createFakeMediaElement();
    const onDone = vi.fn();
    const voice = engine.stream(el as never, { onDone });
    tick();
    el._fire('ended');
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(voice.isPlaying()).toBe(false);
    expect(el._listenerCount()).toBe(0);
    expect(engine.activeVoices()).toBe(0);
  });

  it('stops with its cancelKey', async () => {
    const { engine, tick } = await harness();
    const el = createFakeMediaElement();
    const voice = engine.stream(el as never, { cancelKey: 'bed' });
    tick();
    engine.stopKey('bed');
    expect([voice.isPlaying(), el.paused]).toEqual([false, true]);
  });

  it('loops, seeks and sets the rate on the element', async () => {
    const { engine, tick } = await harness();
    const el = createFakeMediaElement();
    const voice = engine.stream(el as never, { loop: true, offset: 1500, rate: 1.25 });
    tick();
    expect([el.loop, el.currentTime, el.playbackRate]).toEqual([true, 1.5, 1.25]);
    voice.setRate(0.5);
    expect(el.playbackRate).toBe(0.5);
  });

  it('tears the voice down and warns when the element refuses to play', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine, tick } = await harness();
    const el = createFakeMediaElement();
    el._rejectPlay = new Error('NotSupportedError');
    const voice = engine.stream(el as never);
    tick();
    await flush();
    expect(voice.isPlaying()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/NotSupportedError/));
    warn.mockRestore();
  });

  it('drops a stream before unlock, like any voice', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = createFakeAudioContext();
    const engine = createAudioEngine({ context: ctx as never, setTimer: () => 1, clearTimer: () => {} });
    const el = createFakeMediaElement();
    expect(engine.stream(el as never).isPlaying()).toBe(false);
    expect(el.paused).toBe(true);
    warn.mockRestore();
  });
});
