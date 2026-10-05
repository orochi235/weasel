import { createAnalyserTap, type AnalyserTap, type AnalyserTapOptions } from './analyser';
import { atAudioTime, defaultTimers, type Timers } from './audioTime';
import { createBusGraph, type BusHandle } from './buses';
import { writeParam } from './param';
import { createScheduler } from './scheduler';
import { createSoundCache, type SoundHandle } from './soundCache';
import { spatialize, type SpatialOptions, type Vec2 } from './spatialize';
import { createTickTimer } from './tickTimer';
import { resolveEnvelope, type Envelope } from './envelope';
import { toFrequency } from './pitch';
import {
  envelopeOnParam, isInharmonic, noiseBuffer, resolvePartials, voiceFilter,
} from './synthVoice';
import type {
  AudioEngineOptions, Inharmonic, NoiseOptions, NoteOptions, PlayOptions, StreamOptions,
  VoiceFilter, VoiceHandle, Waveform,
} from './types';
import { createVoicePool, type VoicePool } from './voicePool';

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

/** A voice pool and its token index. Tokens restart at 1 in every pool, so the
 *  index has to be per pool — keyed by bus name, a shared pool would look a
 *  steal victim up under the wrong name and silently never tear it down. */
interface Slots {
  pool: VoicePool;
  byToken: Map<number, LiveVoice>;
}

/** What `play` and `playNote` share apart from the node they make. */
type VoiceOptions = Omit<PlayOptions, 'loop'>;

/** What a voice plays through: a scheduled source node, or a stand-in with
 *  the same end-of-life contract — `onended` fires asynchronously, once. */
type SourceLike = Pick<AudioScheduledSourceNode, 'onended' | 'stop' | 'disconnect'>;

/** Several sources stopped together, as one: the first carries `onended`. */
const sourceGroup = (nodes: AudioScheduledSourceNode[]): SourceLike => ({
  get onended() { return nodes[0].onended; },
  set onended(fn) { nodes[0].onended = fn; },
  stop(when?: number) {
    for (const n of nodes) {
      try { n.stop(when); } catch { /* not started, or already stopped */ }
    }
  },
  disconnect() { for (const n of nodes) n.disconnect(); },
});

interface Starter {
  /** False drops the voice when it comes due. */
  ready(): boolean;
  start(voice: LiveVoice, when: number): SourceLike;
}

interface Chain {
  gain: GainNode;
  panner: StereoPannerNode;
}

interface LiveVoice {
  id: number;
  slots: Slots;
  /** Null until the scheduler fires it: a voice booked seconds out must not
   *  hold a slot, and must not be an eviction candidate, while silent. */
  slot: number | null;
  token: number;
  key?: string;
  source: SourceLike | null;
  /** A synth voice's envelope gain, between its sources and the chain. */
  env: GainNode | null;
  /** Writes `rate` and `detune` to the node, once there is one. */
  retune: (() => void) | null;
  /** A synth voice's note-off. Null for a buffer voice, and until it starts. */
  release: (() => void) | null;
  releasing: boolean;
  /** Null once torn down, when the chain goes back to be reused: a handle
   *  that outlives its voice must not write to another voice's nodes. */
  chain: Chain | null;
  baseGain: number;
  spatialGain: number;
  rate: number;
  detune: number;
  /** Kept so `setListener` can re-spatialize a voice that is already playing. */
  position?: Vec2;
  playing: boolean;
  cancelled: boolean;
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
  const random = opts.random ?? Math.random;
  const busNames = opts.buses ?? ['sfx', 'music', 'ui'];
  if (busNames.length === 0) {
    throw new Error('@weasel-js/audio: an engine needs at least one bus');
  }
  const sounds = createSoundCache(ctx, opts.fetchFn);
  // One pool PER BUS, not one global pool: the spec's limit is per-bus, and a
  // shared pool lets a burst of one-shots on `sfx` steal the music bed.
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
    interval: opts.tickInterval,
  });
  scheduler.start();
  const graph = createBusGraph(ctx, busNames, { ...timers, fadeMs: opts.insertFadeMs });

  let listener: Vec2 = { x: 0, y: 0 };
  let spatialOpts: SpatialOptions = {};
  let nextVoiceId = 1;
  let disposed = false;
  let suspendedSince = false;
  /** Engine time before which a queued entry is stale — set on resume, so a
   *  suspension does not end in one pass that fires its whole backlog. */
  let staleFloor = -Infinity;
  const live = new Map<number, LiveVoice>();
  const taps = new Set<AnalyserTap>();

  // An idle chain is kept off its bus: still wired to the destination, it costs
  // the audio thread every render quantum whether or not anything sounds.
  const idleChains: Chain[] = [];
  const idleChainLimit = (opts.voiceLimit ?? 32) * busNames.length;
  const takeChain = (bus: AudioNode, gain: number, pan: number): Chain => {
    let chain = idleChains.pop();
    if (!chain) {
      chain = { gain: ctx.createGain(), panner: ctx.createStereoPanner() };
      chain.panner.connect(chain.gain);
    }
    // Not a bare `.value`: a reused gain can still hold the last voice's fade.
    writeParam(ctx, chain.gain.gain, gain);
    chain.panner.pan.value = pan;
    chain.gain.connect(bus);
    return chain;
  };

  let warnedLocked = false;
  const warnLocked = (): void => {
    if (warnedLocked) return;
    warnedLocked = true;
    console.warn(
      '@weasel-js/audio: play() before the AudioContext was unlocked — the voice was dropped. ' +
      'Browsers require a user gesture; call engine.unlock() from one, or wait for the ' +
      'automatic gesture listener.',
    );
  };

  let warnedDisposed = false;
  const warnDisposed = (): void => {
    if (warnedDisposed) return;
    warnedDisposed = true;
    console.warn('@weasel-js/audio: play() after dispose() — the voice was dropped.');
  };

  let warnedUnknownSound = false;
  const warnUnknownSound = (id: string): void => {
    if (warnedUnknownSound) return;
    warnedUnknownSound = true;
    console.warn(
      `@weasel-js/audio: play() was handed sound "${id}", which this engine never loaded — ` +
      'the voice was dropped. A handle belongs to the engine that produced it.',
    );
  };

  // Resume on the first user gesture, then stop listening.
  const gestures = ['pointerdown', 'keydown', 'touchstart'] as const;
  const onGesture = (): void => { void engine.unlock(); };
  const armGestures = (): void => {
    if (typeof window === 'undefined') return;
    for (const g of gestures) window.addEventListener(g, onGesture, { once: true, passive: true });
  };
  const disarmGestures = (): void => {
    if (typeof window === 'undefined') return;
    for (const g of gestures) window.removeEventListener(g, onGesture);
  };
  armGestures();

  // A browser suspends the context when the tab goes away, and the one-shot
  // gesture listeners are long consumed by then. Without this the engine is
  // permanently silent afterwards, with no diagnostic — the drop warning is a
  // once-per-engine latch.
  const onStateChange = (): void => {
    if (disposed) return;
    if (ctx.state === 'running') {
      if (suspendedSince) staleFloor = now();
      suspendedSince = false;
      return;
    }
    suspendedSince = true;
    warnedLocked = false;
    armGestures();
  };
  ctx.addEventListener('statechange', onStateChange);

  const poolGain = (voice: LiveVoice): void => {
    if (voice.slot === null) return;
    voice.slots.pool.setGain(voice.slot, voice.token, voice.baseGain * voice.spatialGain);
  };

  const applySpatial = (voice: LiveVoice): void => {
    if (!voice.position || !voice.chain) return;
    const s = spatialize(voice.position, listener, spatialOpts);
    voice.spatialGain = s.gain;
    voice.chain.panner.pan.value = s.pan;
    writeParam(ctx, voice.chain.gain.gain, voice.baseGain * s.gain);
    poolGain(voice);
  };

  const teardown = (voice: LiveVoice): void => {
    // First, and never at a call site: teardown is what makes a voice dead, and
    // a queued callback that outlives it must find it cancelled. The steal path
    // has no other place to set this.
    voice.cancelled = true;
    if (!voice.playing && voice.source === null) return;
    voice.playing = false;
    if (voice.source) {
      try { voice.source.stop(); } catch { /* already stopped */ }
      voice.source.disconnect();
    }
    voice.source = null;
    voice.retune = null;
    voice.release = null;
    voice.env?.disconnect();
    voice.env = null;
    if (voice.chain) {
      voice.chain.gain.disconnect();
      if (idleChains.length < idleChainLimit) idleChains.push(voice.chain);
      voice.chain = null;
    }
    live.delete(voice.id);
    if (voice.slot !== null) {
      voice.slots.byToken.delete(voice.token);
      // Safe on the steal path too: the pool has already reissued this slot
      // under a new token, and it ignores a release carrying the old one.
      voice.slots.pool.release(voice.slot, voice.token);
    }
  };

  const dropped = (id: number): VoiceHandle => ({
    id,
    stop: () => {}, release: () => {}, setGain: () => {}, setRate: () => {}, setDetune: () => {},
    setPan: () => {}, setPosition: () => {}, isPlaying: () => false,
  });

  /**
   * Everything a voice does apart from making its node: the lock and dispose
   * checks, the chain, the booking, the stale-backlog check, the slot and any
   * steal, and the handle. `starter.start` builds the node, connects it into
   * `voice.chain.panner` and starts it at the time it is handed.
   */
  const launch = (common: VoiceOptions, starter: Starter): VoiceHandle => {
    const id = nextVoiceId++;

    if (disposed) {
      warnDisposed();
      return dropped(id);
    }
    if (ctx.state !== 'running') {
      warnLocked();
      return dropped(id);
    }

    const busName = common.bus ?? busNames[0];
    const slots = slotsFor(busName);
    const bookedAt = now();
    const when = common.when ?? bookedAt;
    const baseGain = common.gain ?? 1;

    const spatial = common.position
      ? spatialize(common.position, listener, spatialOpts)
      : { gain: 1, pan: common.pan ?? 0 };

    const voice: LiveVoice = {
      id, slots, slot: null, token: 0, key: common.cancelKey,
      source: null, env: null, retune: null, release: null, releasing: false,
      chain: takeChain(graph.input(busName), baseGain * spatial.gain, spatial.pan),
      baseGain, spatialGain: spatial.gain,
      rate: common.rate ?? 1, detune: common.detune ?? 0,
      position: common.position,
      playing: true, cancelled: false,
    };
    live.set(id, voice);

    scheduler.schedule(when, (scheduledWhen) => {
      if (voice.cancelled) return;
      // Came due while the context was suspended: starting it now would play
      // a backlog at once, which is what dropping a locked play avoids. A voice
      // played since the resume is no backlog, however early its `when`.
      if (bookedAt < staleFloor && scheduledWhen < staleFloor) {
        teardown(voice);
        return;
      }
      if (!starter.ready()) {
        teardown(voice);
        return;
      }

      // The slot is taken here, not at booking time. A voice booked a bar out
      // would otherwise hold one while silent — and, its `startedAt` being in
      // the future, be the last thing the 'oldest' policy evicts, so booking
      // a bar of events would evict everything currently audible.
      const acquired = slots.pool.acquire({
        startedAt: scheduledWhen,
        gain: voice.baseGain * voice.spatialGain,
      });
      voice.slot = acquired.slot;
      voice.token = acquired.token;
      slots.byToken.set(acquired.token, voice);
      if (acquired.stolen !== null) {
        const victim = slots.byToken.get(acquired.stolen);
        if (victim) teardown(victim);
      }

      const source = starter.start(voice, scheduledWhen);
      source.onended = () => { teardown(voice); common.onDone?.(); };
      voice.source = source;
    }, common.cancelKey);

    return {
      id,
      stop(fadeMs) {
        if (fadeMs && fadeMs > 0 && voice.source && voice.chain && !voice.cancelled) {
          // Cancelled but not torn down: the fade is what ends this voice, and
          // stopping the source now would cut the ramp scheduled a line above
          // it — which is the click `fadeMs` exists to avoid. `onended` does
          // the bookkeeping when the fade reaches the end.
          voice.cancelled = true;
          writeParam(ctx, voice.chain.gain.gain, 0, fadeMs);
          try { voice.source.stop(ctx.currentTime + fadeMs / 1000); } catch { /* ended */ }
          return;
        }
        teardown(voice);
      },
      release() {
        if (voice.releasing) return;
        if (voice.release && voice.source && !voice.cancelled) {
          // Like a fade: `onended` tears the voice down once the release is out.
          voice.releasing = true;
          voice.cancelled = true;
          voice.release();
          return;
        }
        teardown(voice);
      },
      setGain(value, rampMs) {
        voice.baseGain = value;
        if (!voice.chain) return;
        writeParam(ctx, voice.chain.gain.gain, value * voice.spatialGain, rampMs);
        poolGain(voice);
      },
      setRate(value) {
        voice.rate = value;
        voice.retune?.();
      },
      setDetune(cents) {
        voice.detune = cents;
        voice.retune?.();
      },
      setPan(value) {
        voice.position = undefined;
        if (voice.chain) voice.chain.panner.pan.value = value;
      },
      setPosition(p) {
        voice.position = p;
        applySpatial(voice);
      },
      isPlaying: () => voice.playing,
    };
  };

  /**
   * What every synth voice shares once its sources exist: sources → optional
   * filter → envelope gain → the voice's chain, the envelopes on both, the stop
   * at the end of the release, and the note-off. `make` builds and starts the
   * sources at `t0`, connected into the node it is handed.
   */
  const synthStart = (
    voice: LiveVoice,
    whenMs: number,
    patch: { envelope?: Envelope; filter?: VoiceFilter; duration?: number },
    make: (t0: number, into: AudioNode) => { nodes: AudioScheduledSourceNode[]; retune: () => void },
  ): SourceLike => {
    const t0 = whenMs / 1000;
    const env = resolveEnvelope(patch.envelope);
    const gate = patch.duration;
    // Its own gain, not the chain's: `setGain` and a fade cancel whatever is
    // scheduled on the chain's gain, and would take the envelope with it.
    const shaper = ctx.createGain();
    const amp = envelopeOnParam(shaper.gain, env, gate, t0, (v) => v);
    const filter = patch.filter ? voiceFilter(ctx, patch.filter, gate, t0) : null;
    filter?.node.connect(shaper);
    shaper.connect(voice.chain!.panner);
    voice.env = shaper;

    const { nodes, retune } = make(t0, filter?.node ?? shaper);
    voice.retune = retune;
    retune();
    const stopAll = (at: number): void => { for (const n of nodes) n.stop(at); };
    voice.release = () => {
      const at = ctx.currentTime;
      // Already past its gate: the release is running and the stop is booked.
      if (gate !== undefined && at * 1000 - whenMs >= gate) return;
      amp.release(at);
      filter?.release(at);
      stopAll(at + env.release / 1000);
    };
    if (gate !== undefined) stopAll(t0 + (gate + env.release) / 1000);
    return nodes.length === 1 ? nodes[0] : sourceGroup(nodes);
  };

  const waves = new Map<string, PeriodicWave>();
  const applyWave = (osc: OscillatorNode, wave: Exclude<Waveform, Inharmonic>): void => {
    if (typeof wave === 'string') {
      osc.type = wave;
      return;
    }
    const key = wave.join(',');
    let periodic = waves.get(key);
    if (!periodic) {
      // Sine terms only: partial k sits at imag[k], and index 0 is the DC term.
      const imag = new Float32Array(wave.length + 1);
      imag.set(wave, 1);
      periodic = ctx.createPeriodicWave(new Float32Array(wave.length + 1), imag);
      waves.set(key, periodic);
    }
    osc.setPeriodicWave(periodic);
  };

  // An element can be routed into a graph once, ever: the node is kept for the
  // element's lifetime and handed from voice to voice.
  const mediaSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  const streaming = new WeakMap<HTMLMediaElement, VoiceHandle>();

  const openMedia = (url: string, crossOrigin: StreamOptions['crossOrigin']): HTMLMediaElement => {
    const el = new Audio();
    if (crossOrigin !== undefined) el.crossOrigin = crossOrigin;
    el.preload = 'auto';
    el.src = url;
    return el;
  };

  /** A media element's playback as a voice source: `stop(when)` pauses once
   *  the audio clock reaches `when`, and the element ending ends the voice. */
  const mediaSource = (el: HTMLMediaElement, node: AudioNode, into: AudioNode): SourceLike => {
    let ended = false;
    let cancelWait: (() => void) | null = null;
    const finish = (): void => {
      if (ended) return;
      ended = true;
      cancelWait?.();
      el.pause();
      el.removeEventListener('ended', finish);
      el.removeEventListener('error', finish);
      // Queued, as a source node's `onended` is: the engine may be inside the
      // teardown that called `stop()`.
      queueMicrotask(() => (shim.onended as (() => void) | null)?.());
    };
    const shim: SourceLike = {
      onended: null,
      stop(when?: number) {
        if (ended) return;
        cancelWait?.();
        cancelWait = when !== undefined && when > ctx.currentTime
          ? atAudioTime(ctx, timers, when, finish)
          : null;
        if (!cancelWait) finish();
      },
      disconnect() {
        try { node.disconnect(into); } catch { /* not wired */ }
      },
    };
    el.addEventListener('ended', finish);
    el.addEventListener('error', finish);
    el.play().catch((err: unknown) => {
      if (ended) return;
      console.warn(`@weasel-js/audio: a stream would not start — ${String(err)}`);
      finish();
    });
    return shim;
  };

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

    play(sound, playOpts = {}) {
      return launch(playOpts, {
        ready() {
          if (sounds.buffer(sound)) return true;
          warnUnknownSound(sound.id);
          return false;
        },
        start(voice, when) {
          // A fresh source per play: AudioBufferSourceNode is single-use by
          // specification and cannot be restarted once stopped.
          const source = ctx.createBufferSource();
          source.buffer = sounds.buffer(sound)!;
          source.loop = playOpts.loop ?? false;
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
      });
    },

    playNote(note) {
      // Resolved at the call rather than when it comes due, so a bad pitch or
      // partial throws where it was written.
      const from = toFrequency(note.pitch);
      const glideTo = note.glide ? toFrequency(note.glide.to) : undefined;
      const wave = note.wave ?? 'sine';
      const partials = isInharmonic(wave) ? resolvePartials(wave) : null;
      return launch(note, {
        ready: () => true,
        start: (voice, whenMs) => synthStart(voice, whenMs, note, (t0, into) => {
          const tone = (ratio: number): OscillatorNode => {
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(from * ratio, t0);
            if (glideTo !== undefined) {
              const end = t0 + (note.glide!.ms ?? note.duration ?? 100) / 1000;
              if (note.glide!.curve === 'linear') osc.frequency.linearRampToValueAtTime(glideTo * ratio, end);
              else osc.frequency.exponentialRampToValueAtTime(glideTo * ratio, end);
            }
            return osc;
          };
          let oscs: OscillatorNode[];
          if (partials) {
            // Sines summed by hand: a PeriodicWave can only hold whole-number partials.
            oscs = partials.map((p) => {
              const osc = tone(p.ratio);
              const level = ctx.createGain();
              level.gain.setValueAtTime(p.gain, t0);
              if (p.decay !== undefined) level.gain.setTargetAtTime(0, t0, p.decay / 1000);
              osc.connect(level);
              level.connect(into);
              return osc;
            });
          } else {
            const osc = tone(1);
            applyWave(osc, wave as Exclude<Waveform, Inharmonic>);
            osc.connect(into);
            oscs = [osc];
          }
          for (const osc of oscs) osc.start(t0);
          return {
            nodes: oscs,
            retune: () => {
              for (const osc of oscs) osc.detune.value = voice.detune + 1200 * Math.log2(voice.rate);
            },
          };
        }),
      });
    },

    playNoise(noise) {
      return launch(noise, {
        ready: () => true,
        start: (voice, whenMs) => synthStart(voice, whenMs, noise, (t0, into) => {
          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer(ctx, noise.noise);
          source.loop = true;
          source.connect(into);
          // A random point in the loop, so two hits in a row are not the same hit.
          source.start(t0, random() * source.buffer.duration);
          return {
            nodes: [source],
            retune: () => {
              source.playbackRate.value = voice.rate;
              source.detune.value = voice.detune;
            },
          };
        }),
      });
    },

    stream(media, streamOpts = {}) {
      const el = typeof media === 'string' ? openMedia(media, streamOpts.crossOrigin) : media;
      streaming.get(el)?.stop();
      const handle = launch(streamOpts, {
        ready: () => true,
        start(voice) {
          let node = mediaSources.get(el);
          if (!node) {
            node = ctx.createMediaElementSource(el);
            mediaSources.set(el, node);
          }
          el.loop = streamOpts.loop ?? false;
          if (streamOpts.offset !== undefined) el.currentTime = streamOpts.offset / 1000;
          voice.retune = () => { el.playbackRate = voice.rate; };
          voice.retune();
          const into = voice.chain!.panner;
          node.connect(into);
          return mediaSource(el, node, into);
        },
      });
      streaming.set(el, handle);
      return handle;
    },

    schedule(when, fire, key) {
      if (disposed) return;
      scheduler.schedule(when, fire, key);
    },

    stopKey(key) {
      scheduler.cancelKey(key);
      for (const voice of [...live.values()]) {
        if (voice.key === key) teardown(voice);
      }
    },
    stopAll() {
      for (const voice of [...live.values()]) teardown(voice);
    },
    bus: graph.bus,
    busNames: graph.names,
    activeVoices(bus) {
      if (bus !== undefined) return slotsFor(bus).pool.active();
      let total = 0;
      for (const s of slotsByBus.values()) total += s.pool.active();
      return total;
    },
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
      for (const voice of live.values()) applySpatial(voice);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      engine.stopAll();
      idleChains.length = 0;
      scheduler.stop();
      scheduler.clear();
      tickTimer?.dispose();
      for (const tap of [...taps]) tap.dispose();
      taps.clear();
      disarmGestures();
      ctx.removeEventListener('statechange', onStateChange);
      graph.dispose();
      graph.master.disconnect();
      if (ownsContext) void ctx.close().catch(() => undefined);
    },
  };

  return engine;
}
