import { createAnalyserTap, type AnalyserTap, type AnalyserTapOptions } from './analyser';
import { createBusGraph, type BusHandle } from './buses';
import { writeParam } from './param';
import { createScheduler } from './scheduler';
import { createSoundCache, type SoundHandle } from './soundCache';
import { spatialize, type SpatialOptions, type Vec2 } from './spatialize';
import type { AudioEngineOptions, PlayOptions, VoiceHandle } from './types';
import { createVoicePool, type VoicePool } from './voicePool';

export interface AudioEngine {
  state(): AudioContextState;
  unlock(): Promise<void>;
  /** Engine time in ms. */
  now(): number;
  load(url: string): Promise<SoundHandle>;
  loadAll(urls: Record<string, string>): Promise<Record<string, SoundHandle>>;
  decode(bytes: ArrayBuffer): Promise<SoundHandle>;
  play(sound: SoundHandle, opts?: PlayOptions): VoiceHandle;
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

interface LiveVoice {
  id: number;
  slots: Slots;
  /** Null until the scheduler fires it: a voice booked seconds out must not
   *  hold a slot, and must not be an eviction candidate, while silent. */
  slot: number | null;
  token: number;
  key?: string;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  baseGain: number;
  spatialGain: number;
  rate: number;
  detune: number;
  /** Kept so `setListener` can re-spatialize a voice that is already playing. */
  position?: Vec2;
  playing: boolean;
  cancelled: boolean;
}

export function createAudioEngine(opts: AudioEngineOptions = {}): AudioEngine {
  const ctx = opts.context ?? new AudioContext();
  const busNames = opts.buses ?? ['sfx', 'music', 'ui'];
  if (busNames.length === 0) {
    throw new Error('@weasel-js/audio: an engine needs at least one bus');
  }
  const graph = createBusGraph(ctx, busNames);
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
  const scheduler = createScheduler({
    now,
    // One-shot, not repeating: the scheduler re-arms at the end of every pass,
    // so an interval would leave the previous one running and double the live
    // timer count per tick.
    setTimer: opts.setTimer ?? ((cb, ms) => setTimeout(cb, ms)),
    clearTimer: opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)),
    lookahead: opts.lookahead,
    interval: opts.tickInterval,
  });
  scheduler.start();

  let listener: Vec2 = { x: 0, y: 0 };
  let spatialOpts: SpatialOptions = {};
  let nextVoiceId = 1;
  const live = new Map<number, LiveVoice>();

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
  if (typeof window !== 'undefined') {
    for (const g of gestures) window.addEventListener(g, onGesture, { once: true, passive: true });
  }

  const poolGain = (voice: LiveVoice): void => {
    if (voice.slot === null) return;
    voice.slots.pool.setGain(voice.slot, voice.token, voice.baseGain * voice.spatialGain);
  };

  const applySpatial = (voice: LiveVoice): void => {
    if (!voice.position) return;
    const s = spatialize(voice.position, listener, spatialOpts);
    voice.spatialGain = s.gain;
    voice.panNode.pan.value = s.pan;
    writeParam(ctx, voice.gainNode.gain, voice.baseGain * s.gain);
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
    // Nothing pools the chain, so it goes when the voice does.
    voice.panNode.disconnect();
    voice.gainNode.disconnect();
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
    stop: () => {}, setGain: () => {}, setRate: () => {}, setDetune: () => {},
    setPan: () => {}, setPosition: () => {}, isPlaying: () => false,
  });

  const engine: AudioEngine = {
    state: () => ctx.state,
    async unlock() {
      if (ctx.state !== 'running') await ctx.resume();
    },
    now,
    load: sounds.load,
    loadAll: sounds.loadAll,
    decode: sounds.decode,

    play(sound, playOpts = {}) {
      const id = nextVoiceId++;

      if (ctx.state !== 'running') {
        warnLocked();
        return dropped(id);
      }

      const busName = playOpts.bus ?? busNames[0];
      const slots = slotsFor(busName);
      const when = playOpts.when ?? now();
      const baseGain = playOpts.gain ?? 1;

      const spatial = playOpts.position
        ? spatialize(playOpts.position, listener, spatialOpts)
        : { gain: 1, pan: playOpts.pan ?? 0 };

      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();
      gainNode.gain.value = baseGain * spatial.gain;
      panNode.pan.value = spatial.pan;
      panNode.connect(gainNode);
      gainNode.connect(graph.node(busName));

      const voice: LiveVoice = {
        id, slots, slot: null, token: 0, key: playOpts.cancelKey,
        source: null, gainNode, panNode,
        baseGain, spatialGain: spatial.gain,
        rate: playOpts.rate ?? 1, detune: playOpts.detune ?? 0,
        position: playOpts.position,
        playing: true, cancelled: false,
      };
      live.set(id, voice);

      scheduler.schedule(when, (scheduledWhen) => {
        if (voice.cancelled) return;
        const buffer = sounds.buffer(sound);
        if (!buffer) {
          warnUnknownSound(sound.id);
          teardown(voice);
          return;
        }

        // The slot is taken here, not at play() time. A voice booked a bar out
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

        // A fresh source per play: AudioBufferSourceNode is single-use by
        // specification and cannot be restarted once stopped.
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = playOpts.loop ?? false;
        source.playbackRate.value = voice.rate;
        source.detune.value = voice.detune;
        source.connect(panNode);
        source.onended = () => { teardown(voice); playOpts.onDone?.(); };
        voice.source = source;
        source.start(scheduledWhen / 1000);
      }, playOpts.cancelKey);

      return {
        id,
        stop(fadeMs) {
          if (fadeMs && fadeMs > 0 && voice.source && !voice.cancelled) {
            // Cancelled but not torn down: the fade is what ends this voice, and
            // stopping the source now would cut the ramp scheduled a line above
            // it — which is the click `fadeMs` exists to avoid. `onended` does
            // the bookkeeping when the fade reaches the end.
            voice.cancelled = true;
            writeParam(ctx, gainNode.gain, 0, fadeMs);
            try { voice.source.stop(ctx.currentTime + fadeMs / 1000); } catch { /* ended */ }
            return;
          }
          teardown(voice);
        },
        setGain(value, rampMs) {
          voice.baseGain = value;
          writeParam(ctx, gainNode.gain, value * voice.spatialGain, rampMs);
          poolGain(voice);
        },
        setRate(value) {
          voice.rate = value;
          if (voice.source) voice.source.playbackRate.value = value;
        },
        setDetune(cents) {
          voice.detune = cents;
          if (voice.source) voice.source.detune.value = cents;
        },
        setPan(value) {
          voice.position = undefined;
          panNode.pan.value = value;
        },
        setPosition(p) {
          voice.position = p;
          applySpatial(voice);
        },
        isPlaying: () => voice.playing,
      };
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
    analyser: (busName, tapOpts) =>
      createAnalyserTap(ctx, busName ? graph.node(busName) : graph.master, tapOpts),
    setListener(p, o) {
      listener = p;
      if (o) spatialOpts = o;
      for (const voice of live.values()) applySpatial(voice);
    },
    dispose() {
      engine.stopAll();
      scheduler.stop();
      scheduler.clear();
      if (typeof window !== 'undefined') {
        for (const g of gestures) window.removeEventListener(g, onGesture);
      }
    },
  };

  return engine;
}
