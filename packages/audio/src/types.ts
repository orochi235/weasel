import type { Vec2 } from './spatialize';
import type { SoundHandle } from './soundCache';
import type { StealPolicy } from './voicePool';

export interface PlayOptions {
  /** Default 'sfx'. */
  bus?: string;
  /** 0..1, default 1. Multiplied by any spatialized gain. */
  gain?: number;
  /** Playback rate, default 1. */
  rate?: number;
  /** Detune in cents, default 0. */
  detune?: number;
  loop?: boolean;
  /** Explicit stereo pan, -1..1. Ignored when `position` is given. */
  pan?: number;
  /** World position; spatialized against the engine listener. */
  position?: Vec2;
  /** Engine time in ms (see `engine.now()`). Default: as soon as possible. */
  when?: number;
  /** `stopKey(key)` stops every voice sharing this key. */
  cancelKey?: string;
  onDone?: () => void;
}

export interface VoiceHandle {
  id: number;
  stop(fadeMs?: number): void;
  setGain(value: number, rampMs?: number): void;
  setRate(value: number): void;
  setPan(value: number): void;
  setPosition(p: Vec2): void;
  isPlaying(): boolean;
}

export interface AudioEngineOptions {
  /** Injectable for tests and for consumers that own the context. */
  context?: AudioContext;
  /** Scheduling window in ms. Default 100. */
  lookahead?: number;
  /** Scheduler pass interval in ms. Default 25. */
  tickInterval?: number;
  /** Default ['sfx', 'music', 'ui']. */
  buses?: string[];
  /** Max concurrent voices PER BUS before stealing. Default 32. */
  voiceLimit?: number;
  /** Default 'oldest'. */
  steal?: StealPolicy;
  fetchFn?: typeof fetch;
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export type { SoundHandle, Vec2, StealPolicy };
