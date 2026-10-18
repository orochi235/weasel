import { createAnalyserTap, type AnalyserTap, type AnalyserTapOptions } from './analyser';
import { defaultTimers, type Timers } from './audioTime';
import { createBusGraph, type BusHandle } from './buses';
import type { Slots, Starter } from './liveVoice';
import { createResumeWatch } from './resumeWatch';
import { createScheduler } from './scheduler';
import { createSoundCache, type SoundCache, type SoundHandle } from './soundCache';
import type { SpatialOptions, Vec2 } from './spatialize';
import { createStreamStarters } from './streamStarter';
import { createSynthStarters } from './synthStarters';
import { createTickTimer } from './tickTimer';
import type {
  AudioEngineOptions, NoiseOptions, NoteOptions, PlayOptions, StreamOptions, VoiceHandle,
} from './types';
import { createChainPool } from './voiceChains';
import { createDropWarnings, type DropWarnings } from './voiceDrops';
import { createVoicePool } from './voicePool';
import { createVoices } from './voices';

/** A sound engine: named mix buses, a per-bus voice pool, lookahead
 *  scheduling and 2D spatialization over one `AudioContext`. Times are engine
 *  ms (`now()`). */
export interface AudioEngine {
  /** The engine's `AudioContext` — the one passed as `options.context`, or the
   *  one the engine created. Use it for `createBuffer`, for analysis, or for a
   *  node graph of your own alongside the engine's.
   *
   *  `dispose()` closes a context the engine created, and every call on a
   *  closed context throws; a context you passed in is left open, because it is
   *  yours to close. The reference stays valid either way — read `state()`
   *  rather than assuming. */
  readonly context: AudioContext;
  state(): AudioContextState;
  unlock(): Promise<void>;
  /** Engine time in ms. */
  now(): number;
  load(url: string): Promise<SoundHandle>;
  loadAll(urls: Record<string, string>): Promise<Record<string, SoundHandle>>;
  decode(bytes: ArrayBuffer): Promise<SoundHandle>;
  /** Play a buffer the consumer already holds — a synth, an offline render, a
   *  recording. `load` and `decode` both assume encoded bytes. */
  register(buffer: AudioBuffer): SoundHandle;
  play(sound: SoundHandle, opts?: PlayOptions): VoiceHandle;
  /** Play a synthesized note: an oscillator with harmonic partials, or summed
   *  sines at any ratios, under an ADSR envelope and an optional filter. It is a voice like any other — same handle, same bus pool
   *  and stealing, same `cancelKey`. */
  playNote(note: NoteOptions): VoiceHandle;
  /** Play noise — white, pink or brown, from a looping buffer made once per
   *  context — under an envelope and an optional filter with its own cutoff
   *  envelope. A voice like `playNote`'s in every other respect. */
  playNoise(noise: NoiseOptions): VoiceHandle;
  /** Stream long audio — music, ambience — from a media element or a URL
   *  through a `MediaElementAudioSourceNode`, instead of decoding it whole. It
   *  is a voice on a bus like any other, with the exceptions `StreamOptions`
   *  lists. An element has one playhead, so streaming one that is already
   *  streaming stops the earlier voice. */
  stream(media: HTMLMediaElement | string, opts?: StreamOptions): VoiceHandle;
  /** Book a callback against the audio clock through the engine's lookahead
   *  scheduler; it receives its own `when` to hand on to `play` or `playNote`.
   *  `stopKey(key)` cancels it. One that came due during a suspension fires
   *  late on resume, with its original `when`, so compare against `now()`. */
  schedule(when: number, fire: (when: number) => void, key?: string): void;
  stopKey(key: string): void;
  stopAll(): void;
  bus(name: string): BusHandle;
  /** The configured bus names, in order. The first is `play()`'s default. */
  busNames(): string[];
  /** Voices currently sounding, on one bus or on all of them. A voice booked
   *  for a future `when` is not counted until it starts. */
  activeVoices(bus?: string): number;
  analyser(busName?: string, opts?: AnalyserTapOptions): AnalyserTap;
  setListener(p: Vec2, opts?: SpatialOptions): void;
  dispose(): void;
}

/** How `play` makes its node: a fresh buffer source per voice. */
function bufferStarter(
  ctx: BaseAudioContext, sounds: SoundCache, warn: DropWarnings, sound: SoundHandle, loop: boolean,
): Starter {
  return {
    ready() {
      if (sounds.buffer(sound)) return true;
      warn.unknownSound(sound.id);
      return false;
    },
    start(voice, when) {
      // A fresh source per play: AudioBufferSourceNode is single-use by
      // specification and cannot be restarted once stopped.
      const source = ctx.createBufferSource();
      source.buffer = sounds.buffer(sound)!;
      source.loop = loop;
      voice.retune = () => {
        source.playbackRate.value = voice.rate;
        source.detune.value = voice.detune;
      };
      voice.retune();
      // Still live when this runs, so the voice still holds its chain.
      source.connect(voice.chain!.panner);
      source.start(when / 1000);
      return source;
    },
  };
}

/** One voice pool per bus, not one global pool: the limit is per bus, and a
 *  shared pool lets a burst of one-shots on `sfx` steal the music bed. */
function busSlots(busNames: string[], opts: AudioEngineOptions) {
  const slotsByBus = new Map<string, Slots>();
  for (const name of busNames) {
    slotsByBus.set(name, {
      pool: createVoicePool({ limit: opts.voiceLimit ?? 32, steal: opts.steal }),
      byToken: new Map(),
    });
  }
  const slotsFor = (bus: string): Slots => {
    const s = slotsByBus.get(bus);
    if (!s) throw new Error(`@weasel-js/audio: unknown bus "${bus}"`);
    return s;
  };
  const active = (bus?: string): number => {
    if (bus !== undefined) return slotsFor(bus).pool.active();
    let total = 0;
    for (const s of slotsByBus.values()) total += s.pool.active();
    return total;
  };
  return { slotsFor, active };
}

/** The timer that wakes the scheduler, and the scheduler. */
function engineClock(ctx: BaseAudioContext, opts: AudioEngineOptions) {
  const now = (): number => ctx.currentTime * 1000;
  const tickTimer = opts.setTimer === undefined && opts.clearTimer === undefined
    ? createTickTimer()
    : null;
  const timers: Timers = {
    setTimer: tickTimer?.setTimer ?? opts.setTimer ?? defaultTimers.setTimer,
    clearTimer: tickTimer?.clearTimer ?? opts.clearTimer ?? defaultTimers.clearTimer,
  };
  const scheduler = createScheduler({
    now,
    // One-shot, not repeating: the scheduler re-arms at the end of every pass,
    // so an interval would leave the previous one running and double the live
    // timer count per tick.
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    lookahead: opts.lookahead,
    interval: opts.tickInterval, onLate: opts.onLate,
  });
  scheduler.start();
  return { now, tickTimer, timers, scheduler };
}

/**
 * Create an engine. Browsers start the context suspended: `play()` before it
 * is unlocked drops the voice with a warning. The engine resumes it on the
 * first pointer, key or touch gesture, or call `unlock()` from one. Call
 * `dispose()` when done.
 */
export function createAudioEngine(opts: AudioEngineOptions = {}): AudioEngine {
  const ctx = opts.context ?? new AudioContext();
  // A context the engine made is a context the engine closes; a consumer's is
  // theirs to keep.
  const ownsContext = opts.context === undefined;
  const busNames = opts.buses ?? ['sfx', 'music', 'ui'];
  if (busNames.length === 0) {
    throw new Error('@weasel-js/audio: an engine needs at least one bus');
  }
  const sounds = createSoundCache(ctx, opts.fetchFn);
  const { slotsFor, active } = busSlots(busNames, opts);
  const { now, tickTimer, timers, scheduler } = engineClock(ctx, opts);
  const graph = createBusGraph(ctx, busNames, { ...timers, fadeMs: opts.insertFadeMs });

  let listener: Vec2 = { x: 0, y: 0 };
  let spatialOpts: SpatialOptions = {};
  let disposed = false;
  const taps = new Set<AnalyserTap>();
  const chains = createChainPool(ctx, (opts.voiceLimit ?? 32) * busNames.length);
  const warn = createDropWarnings();
  const watch = createResumeWatch(ctx, {
    now,
    unlock: () => engine.unlock(),
    onSuspend: () => warn.rearmLocked(),
  });
  const voices = createVoices({
    ctx, scheduler, chains, slotsFor, warn,
    busInput: graph.input,
    defaultBus: busNames[0],
    staleFloor: watch.staleFloor,
    disposed: () => disposed,
    listener: () => ({ at: listener, opts: spatialOpts }),
  });
  const synth = createSynthStarters(ctx, opts.random ?? Math.random);
  const streams = createStreamStarters(ctx, timers);

  const engine: AudioEngine = {
    context: ctx,
    state: () => ctx.state,
    async unlock() {
      if (disposed) return;
      if (ctx.state !== 'running') await ctx.resume();
    },
    now,
    load: sounds.load,
    loadAll: sounds.loadAll,
    decode: sounds.decode,
    register: sounds.register,
    play: (sound, playOpts = {}) =>
      voices.launch(playOpts, bufferStarter(ctx, sounds, warn, sound, playOpts.loop ?? false)),
    playNote: (note) => voices.launch(note, synth.note(note)),
    playNoise: (noise) => voices.launch(noise, synth.noise(noise)),
    stream(media, streamOpts = {}) {
      const el = streams.element(media, streamOpts);
      streams.streaming.get(el)?.stop();
      const handle = voices.launch(streamOpts, streams.starter(el, streamOpts));
      streams.streaming.set(el, handle);
      return handle;
    },
    schedule(when, fire, key) {
      if (disposed) return;
      scheduler.schedule(when, fire, key);
    },
    stopKey(key) {
      scheduler.cancelKey(key);
      voices.stopKey(key);
    },
    stopAll: () => voices.stopAll('stopped'),
    bus: graph.bus,
    busNames: graph.names,
    activeVoices: active,
    analyser(busName, tapOpts) {
      // Every tap is one more live FFT on the graph. They are tracked so
      // `dispose()` detaches them; a consumer calling this per frame still
      // wants to keep one tap rather than mint one.
      const tap = createAnalyserTap(ctx, busName ? graph.node(busName) : graph.master, tapOpts);
      taps.add(tap);
      return {
        ...tap,
        dispose() {
          taps.delete(tap);
          tap.dispose();
        },
      };
    },
    setListener(p, o) {
      listener = p;
      if (o) spatialOpts = o;
      voices.respatialize();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      voices.stopAll('disposed');
      chains.clear();
      scheduler.stop();
      scheduler.clear();
      tickTimer?.dispose();
      for (const tap of [...taps]) tap.dispose();
      taps.clear();
      watch.dispose();
      graph.dispose();
      graph.master.disconnect();
      if (ownsContext) void ctx.close().catch(() => undefined);
    },
  };

  return engine;
}
