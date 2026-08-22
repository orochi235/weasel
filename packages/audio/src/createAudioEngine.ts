import { createAnalyserTap, type AnalyserTap, type AnalyserTapOptions } from './analyser';
import { createBusGraph, type BusHandle } from './buses';
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
  analyser(busName?: string, opts?: AnalyserTapOptions): AnalyserTap;
  setListener(p: Vec2, opts?: SpatialOptions): void;
  dispose(): void;
}

interface LiveVoice {
  id: number;
  slot: number;
  /** The pool's identity for this voice. A stolen slot is reissued at once, so
   *  releasing or re-gaining by slot alone would hit whoever holds it now. */
  token: number;
  /** Slots are per-bus, so a voice must remember which pool owns its slot. */
  bus: string;
  key?: string;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  baseGain: number;
  playing: boolean;
  cancelled: boolean;
}

export function createAudioEngine(opts: AudioEngineOptions = {}): AudioEngine {
  const ctx = opts.context ?? new AudioContext();
  const busNames = opts.buses ?? ['sfx', 'music', 'ui'];
  const graph = createBusGraph(ctx, busNames);
  const sounds = createSoundCache(ctx, opts.fetchFn);
  // One pool PER BUS, not one global pool: the spec's limit is per-bus, and a
  // shared pool lets a burst of one-shots on `sfx` steal the music bed.
  const pools = new Map<string, VoicePool>();
  for (const name of busNames) {
    pools.set(name, createVoicePool({ limit: opts.voiceLimit ?? 32, steal: opts.steal }));
  }
  const poolFor = (bus: string): VoicePool => {
    const p = pools.get(bus);
    if (!p) throw new Error(`@weasel-js/audio: unknown bus "${bus}"`);
    return p;
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
  // Keyed `bus:token` — tokens restart at 1 in every pool, so a bare token
  // collides across buses and tears down the wrong voice.
  const byToken = new Map<string, LiveVoice>();
  const voiceKey = (bus: string, token: number): string => `${bus}:${token}`;

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

  // Resume on the first user gesture, then stop listening.
  const gestures = ['pointerdown', 'keydown', 'touchstart'] as const;
  const onGesture = (): void => { void engine.unlock(); };
  if (typeof window !== 'undefined') {
    for (const g of gestures) window.addEventListener(g, onGesture, { once: true, passive: true });
  }

  const teardown = (voice: LiveVoice): void => {
    // First, and never at a call site: teardown is what makes a voice dead, and
    // a queued callback that outlives it must find it cancelled. The steal path
    // has no other place to set this.
    voice.cancelled = true;
    if (!voice.playing && voice.source === null) return;
    voice.playing = false;
    try { voice.source?.stop(); } catch { /* already stopped */ }
    voice.source = null;
    live.delete(voice.id);
    byToken.delete(voiceKey(voice.bus, voice.token));
    // Safe on the steal path too: the pool has already reissued this slot
    // under a new token, and it ignores a release carrying the old one.
    poolFor(voice.bus).release(voice.slot, voice.token);
  };

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
        return {
          id,
          stop: () => {}, setGain: () => {}, setRate: () => {},
          setPan: () => {}, setPosition: () => {}, isPlaying: () => false,
        };
      }

      const busName = playOpts.bus ?? busNames[0];
      const when = playOpts.when ?? now();
      const explicitGain = playOpts.gain ?? 1;

      const spatial = playOpts.position
        ? spatialize(playOpts.position, listener, spatialOpts)
        : { gain: 1, pan: playOpts.pan ?? 0 };

      const pool = poolFor(busName);
      const acquired = pool.acquire({ startedAt: when, gain: explicitGain * spatial.gain });
      if (acquired.stolen !== null) {
        const victim = byToken.get(voiceKey(busName, acquired.stolen));
        if (victim) teardown(victim);
      }

      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();
      gainNode.gain.value = explicitGain * spatial.gain;
      panNode.pan.value = spatial.pan;
      panNode.connect(gainNode);
      gainNode.connect(graph.node(busName));

      const voice: LiveVoice = {
        id, slot: acquired.slot, token: acquired.token, bus: busName,
        key: playOpts.cancelKey, source: null, gainNode, panNode,
        baseGain: explicitGain, playing: true, cancelled: false,
      };
      live.set(id, voice);
      byToken.set(voiceKey(busName, voice.token), voice);

      scheduler.schedule(when, (scheduledWhen) => {
        if (voice.cancelled) return;
        // A fresh source per play: AudioBufferSourceNode is single-use by
        // specification and cannot be restarted once stopped.
        const source = ctx.createBufferSource();
        source.buffer = sounds.buffer(sound);
        source.loop = playOpts.loop ?? false;
        source.playbackRate.value = playOpts.rate ?? 1;
        source.detune.value = playOpts.detune ?? 0;
        source.connect(panNode);
        source.onended = () => { teardown(voice); playOpts.onDone?.(); };
        voice.source = source;
        source.start(scheduledWhen / 1000);
      }, playOpts.cancelKey);

      return {
        id,
        stop(fadeMs) {
          if (fadeMs && fadeMs > 0) {
            gainNode.gain.linearRampToValueAtTime?.(0, ctx.currentTime + fadeMs / 1000);
          }
          teardown(voice);
        },
        setGain(value, rampMs) {
          voice.baseGain = value;
          if (rampMs && rampMs > 0) {
            gainNode.gain.linearRampToValueAtTime?.(value, ctx.currentTime + rampMs / 1000);
          } else {
            gainNode.gain.value = value;
          }
          poolFor(voice.bus).setGain(voice.slot, voice.token, value);
        },
        setRate(value) { if (voice.source) voice.source.playbackRate.value = value; },
        setPan(value) { panNode.pan.value = value; },
        setPosition(p) {
          const s = spatialize(p, listener, spatialOpts);
          panNode.pan.value = s.pan;
          gainNode.gain.value = voice.baseGain * s.gain;
          poolFor(voice.bus).setGain(voice.slot, voice.token, voice.baseGain * s.gain);
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
    analyser: (busName, tapOpts) =>
      createAnalyserTap(ctx, busName ? graph.node(busName) : graph.master, tapOpts),
    setListener(p, o) {
      listener = p;
      if (o) spatialOpts = o;
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
