/** Minimal Web Audio double. Records connections and calls so tests can assert
 *  graph shape and scheduling without a browser. Not a spec implementation —
 *  it covers exactly the surface `createAudioEngine` touches, and throws where
 *  the specification says a real implementation throws. */

import { createFakeAnalyser, type FakeAnalyser, type FakeAnalyserBytes } from './fakeAnalyser';
import type { FakeMediaElement, FakeMediaSource } from './fakeMediaElement';
import {
  node, param,
  type FakeBiquad, type FakeCompressor, type FakeConvolver, type FakeDelay, type FakeGain, type FakeNode,
  type FakePanner,
} from './fakeNode';
import {
  createFakeBufferSource, createFakeOscillator, dueToEnd,
  type FakeOscillator, type FakePeriodicWave, type FakeSource,
} from './fakeSources';

export type { FakeAnalyser, FakeAnalyserBytes } from './fakeAnalyser';
export { createFakeMediaElement, type FakeMediaElement, type FakeMediaSource } from './fakeMediaElement';
export type {
  FakeBiquad, FakeCompressor, FakeConvolver, FakeDelay, FakeGain, FakeNode, FakePanner, FakeParam,
} from './fakeNode';
export type { FakeOscillator, FakePeriodicWave, FakeSource } from './fakeSources';

/** Enough of an `AudioBuffer` for the engine's source nodes and for a consumer
 *  filling one through `engine.context`. */
export interface FakeBuffer {
  duration: number;
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface FakeAudioContext {
  state: 'suspended' | 'running' | 'closed';
  currentTime: number;
  sampleRate: number;
  destination: FakeNode;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: 'statechange', fn: () => void): void;
  removeEventListener(type: 'statechange', fn: () => void): void;
  createGain(): FakeGain;
  createStereoPanner(): FakePanner;
  createAnalyser(): FakeAnalyser;
  createBufferSource(): FakeSource;
  createOscillator(): FakeOscillator;
  createPeriodicWave(real: Float32Array, imag: Float32Array): FakePeriodicWave;
  createBiquadFilter(): FakeBiquad;
  createConvolver(): FakeConvolver;
  createDelay(maxDelayTime?: number): FakeDelay;
  createDynamicsCompressor(): FakeCompressor;
  /** Throws for an element that already has a source, as the specification
   *  requires: an element can be routed into a graph once. */
  createMediaElementSource(element: FakeMediaElement): FakeMediaSource;
  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer;
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  /** Test hook: advance the audio clock, ending any source that comes due. */
  _advance(ms: number): void;
  /** Test hook: end a source now, firing `onended` once. */
  _end(source: FakeSource | FakeOscillator): void;
  /** Test hook: change state and notify `statechange` listeners. */
  _setState(state: 'suspended' | 'running' | 'closed'): void;
  /** Test hook: every buffer source node created, in order. */
  _sources: FakeSource[];
  /** Test hook: every oscillator created, in order. */
  _oscillators: FakeOscillator[];
  /** Test hook: every biquad filter created, in order. */
  _filters: FakeBiquad[];
  /** Test hook: every buffer created, in order. */
  _buffers: FakeBuffer[];
  /** Test hook: canned analyser output. */
  _analyserBytes: FakeAnalyserBytes;
  /** Test hook: live `statechange` subscriptions. */
  _listenerCount(): number;
}

function createFakeBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
  if (channels < 1 || length < 1) {
    throw new Error('NotSupportedError: createBuffer needs a channel and a frame');
  }
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    duration: length / sampleRate,
    length,
    numberOfChannels: channels,
    sampleRate,
    getChannelData: (channel) => data[channel],
  };
}

export function createFakeAudioContext(): FakeAudioContext {
  const sources: FakeSource[] = [];
  const oscillators: FakeOscillator[] = [];
  const filters: FakeBiquad[] = [];
  const buffers: FakeBuffer[] = [];
  const listeners = new Set<() => void>();
  const routed = new WeakSet<FakeMediaElement>();
  const now = (): number => ctx.currentTime;

  const ctx: FakeAudioContext = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 48000,
    destination: node('destination'),
    async resume() { ctx._setState('running'); },
    async suspend() { ctx._setState('suspended'); },
    async close() { ctx._setState('closed'); },
    addEventListener(_type, fn) { listeners.add(fn); },
    removeEventListener(_type, fn) { listeners.delete(fn); },
    createGain: () => node('gain', { gain: param(1) }),
    createStereoPanner: () => node('panner', { pan: param(0) }),
    createAnalyser: () => createFakeAnalyser(() => ctx._analyserBytes),
    createBufferSource() {
      const s = createFakeBufferSource(now);
      sources.push(s);
      return s;
    },
    createOscillator() {
      const o = createFakeOscillator(now);
      oscillators.push(o);
      return o;
    },
    createPeriodicWave: (real, imag) => ({ real, imag }),
    createBiquadFilter() {
      const f = node('biquad', {
        type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0), detune: param(0),
      });
      filters.push(f);
      return f;
    },
    createConvolver: () => node('convolver', { buffer: null as unknown, normalize: true }),
    createDelay: (maxDelayTime = 1) => node('delay', { delayTime: param(0), maxDelayTime }),
    createDynamicsCompressor: () => node('compressor', {
      threshold: param(-24), knee: param(30), ratio: param(12),
      attack: param(0.003), release: param(0.25),
    }),
    createMediaElementSource(element) {
      if (routed.has(element)) {
        throw new Error('InvalidStateError: the element already has a MediaElementAudioSourceNode');
      }
      routed.add(element);
      return node('mediaSource', { mediaElement: element });
    },
    createBuffer(channels, length, sampleRate) {
      const buffer = createFakeBuffer(channels, length, sampleRate);
      buffers.push(buffer);
      return buffer;
    },
    async decodeAudioData() { return { duration: 1 }; },
    // `onended` fires from the clock, never from inside `start`/`stop`: a real
    // implementation queues it as a task, and firing it synchronously would
    // re-enter whatever called `stop`.
    _advance(ms) {
      ctx.currentTime += ms / 1000;
      for (const s of [...sources, ...oscillators]) {
        if (dueToEnd(s, ctx.currentTime)) ctx._end(s);
      }
    },
    _end(source) {
      if (source.ended) return;
      source.ended = true;
      source.onended?.();
    },
    _setState(state) {
      if (ctx.state === state) return;
      ctx.state = state;
      for (const fn of [...listeners]) fn();
    },
    _sources: sources,
    _oscillators: oscillators,
    _filters: filters,
    _buffers: buffers,
    _listenerCount: () => listeners.size,
    _analyserBytes: (i, length) => Math.round((255 * i) / length),
  };
  return ctx;
}
