/** Minimal Web Audio double. Records connections and calls so tests can assert
 *  graph shape and scheduling without a browser. Not a spec implementation —
 *  it covers exactly the surface `createAudioEngine` touches, and throws where
 *  the specification says a real implementation throws. */

export interface FakeParam {
  value: number;
  /** Every `linearRampToValueAtTime` target, in call order. */
  ramps: { value: number; at: number }[];
  /** Every `setValueAtTime`, in call order. */
  holds: { value: number; at: number }[];
  /** Every `exponentialRampToValueAtTime` target, in call order. */
  expRamps: { value: number; at: number }[];
  /** Every `cancelScheduledValues` time, in call order. */
  cancels: number[];
  setValueAtTime(value: number, at: number): FakeParam;
  linearRampToValueAtTime(value: number, at: number): FakeParam;
  exponentialRampToValueAtTime(value: number, at: number): FakeParam;
  cancelScheduledValues(at: number): FakeParam;
}

// A ramp does not move `value`: the point of the double is that a test can see
// a target scheduled ahead of the current value rather than written over it.
const param = (initial: number): FakeParam => {
  const p: FakeParam = {
    value: initial,
    ramps: [],
    holds: [],
    expRamps: [],
    cancels: [],
    setValueAtTime(value, at) { p.holds.push({ value, at }); p.value = value; return p; },
    linearRampToValueAtTime(value, at) { p.ramps.push({ value, at }); return p; },
    exponentialRampToValueAtTime(value, at) { p.expRamps.push({ value, at }); return p; },
    cancelScheduledValues(at) { p.cancels.push(at); return p; },
  };
  return p;
};

export interface FakeNode {
  kind: string;
  connectedTo: FakeNode[];
  connectedFrom: FakeNode[];
  /** True once `disconnect` has been called on this node in any form. */
  disconnected: boolean;
  connect(target: FakeNode): FakeNode;
  disconnect(target?: FakeNode): void;
}

function node<E extends Record<string, unknown>>(kind: string, extra?: E): FakeNode & E {
  const n = {
    kind,
    connectedTo: [] as FakeNode[],
    connectedFrom: [] as FakeNode[],
    disconnected: false,
    connect(target: FakeNode) {
      n.connectedTo.push(target);
      target.connectedFrom.push(n);
      return target;
    },
    disconnect(target?: FakeNode) {
      n.disconnected = true;
      if (target && !n.connectedTo.includes(target)) {
        // The bare form is a no-op when there is nothing to cut; the targeted
        // form is not, and a real implementation throws.
        throw new Error('InvalidAccessError: the given node is not connected');
      }
      for (const t of target ? [target] : [...n.connectedTo]) {
        const out = n.connectedTo.indexOf(t);
        if (out >= 0) n.connectedTo.splice(out, 1);
        const back = t.connectedFrom.indexOf(n);
        if (back >= 0) t.connectedFrom.splice(back, 1);
      }
    },
    ...(extra ?? ({} as E)),
  } as FakeNode & E;
  return n;
}

export interface FakeGain extends FakeNode { gain: FakeParam }
export interface FakePanner extends FakeNode { pan: FakeParam }

export interface FakeAnalyser extends FakeNode {
  fftSize: number;
  readonly frequencyBinCount: number;
  getByteFrequencyData(out: Uint8Array): void;
  getByteTimeDomainData(out: Uint8Array): void;
}

export interface FakeSource extends FakeNode {
  buffer: unknown;
  loop: boolean;
  playbackRate: FakeParam;
  detune: FakeParam;
  started: number[];
  stopped: number[];
  ended: boolean;
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface FakePeriodicWave { real: Float32Array; imag: Float32Array }

export interface FakeOscillator extends FakeNode {
  type: string;
  frequency: FakeParam;
  detune: FakeParam;
  periodicWave: FakePeriodicWave | null;
  started: number[];
  stopped: number[];
  ended: boolean;
  onended: (() => void) | null;
  setPeriodicWave(wave: FakePeriodicWave): void;
  start(when?: number): void;
  stop(when?: number): void;
}

/** Analyser output: a constant for every bin, or a function of bin index and
 *  window length so index and window-size math is observable. */
export type FakeAnalyserBytes = number | ((index: number, length: number) => number);

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
  /** Test hook: canned analyser output. */
  _analyserBytes: FakeAnalyserBytes;
  /** Test hook: live `statechange` subscriptions. */
  _listenerCount(): number;
}

export function createFakeAudioContext(): FakeAudioContext {
  const sources: FakeSource[] = [];
  const oscillators: FakeOscillator[] = [];
  const listeners = new Set<() => void>();

  // Writes at most `bins` elements, as the specification requires: an oversized
  // array keeps whatever was in the tail, it does not get more data.
  const fill = (out: Uint8Array, bins: number, spec: FakeAnalyserBytes): void => {
    const n = Math.min(out.length, bins);
    for (let i = 0; i < n; i += 1) {
      out[i] = typeof spec === 'function' ? spec(i, n) : spec;
    }
  };

  // `onended` fires from the clock, never from inside `start`/`stop`: a real
  // implementation queues it as a task, and firing it synchronously would
  // re-enter whatever called `stop`.
  // The last `stop` wins: the specification lets a later call replace an
  // earlier one.
  const endIfDue = (s: FakeSource | FakeOscillator): void => {
    if (s.ended || s.started.length === 0) return;
    const stopAt = s.stopped.length > 0 ? s.stopped[s.stopped.length - 1] : Infinity;
    const duration = 'buffer' in s ? (s.buffer as { duration?: number } | null)?.duration : undefined;
    const endsAt = 'buffer' in s && !s.loop && duration != null ? s.started[0] + duration : Infinity;
    if (ctx.currentTime + 1e-9 >= Math.min(stopAt, endsAt)) ctx._end(s);
  };

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
    createAnalyser() {
      const a = node('analyser', {
        fftSize: 2048,
        getByteFrequencyData(out: Uint8Array) { fill(out, a.fftSize / 2, ctx._analyserBytes); },
        getByteTimeDomainData(out: Uint8Array) { fill(out, a.fftSize, ctx._analyserBytes); },
      });
      Object.defineProperty(a, 'frequencyBinCount', {
        get: () => a.fftSize / 2,
        enumerable: true,
      });
      return a as unknown as FakeAnalyser;
    },
    createBufferSource() {
      const s: FakeSource = node('source', {
        buffer: null as unknown,
        loop: false,
        playbackRate: param(1),
        detune: param(0),
        started: [] as number[],
        stopped: [] as number[],
        ended: false,
        onended: null as (() => void) | null,
        start(when = ctx.currentTime) {
          if (s.started.length > 0) {
            throw new Error('InvalidStateError: start may only be called once');
          }
          s.started.push(when);
        },
        stop(when = ctx.currentTime) {
          if (s.started.length === 0) {
            throw new Error('InvalidStateError: stop called before start');
          }
          s.stopped.push(when);
        },
      });
      sources.push(s);
      return s;
    },
    createOscillator() {
      const o: FakeOscillator = node('oscillator', {
        type: 'sine',
        frequency: param(440),
        detune: param(0),
        periodicWave: null as FakePeriodicWave | null,
        started: [] as number[],
        stopped: [] as number[],
        ended: false,
        onended: null as (() => void) | null,
        setPeriodicWave(wave: FakePeriodicWave) { o.type = 'custom'; o.periodicWave = wave; },
        start(when = ctx.currentTime) {
          if (o.started.length > 0) {
            throw new Error('InvalidStateError: start may only be called once');
          }
          o.started.push(when);
        },
        stop(when = ctx.currentTime) {
          if (o.started.length === 0) {
            throw new Error('InvalidStateError: stop called before start');
          }
          o.stopped.push(when);
        },
      });
      oscillators.push(o);
      return o;
    },
    createPeriodicWave: (real, imag) => ({ real, imag }),
    createBuffer(channels, length, sampleRate) {
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
    },
    async decodeAudioData() { return { duration: 1 }; },
    _advance(ms) {
      ctx.currentTime += ms / 1000;
      for (const s of [...sources, ...oscillators]) endIfDue(s);
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
    _listenerCount: () => listeners.size,
    _analyserBytes: (i, length) => Math.round((255 * i) / length),
  };
  return ctx;
}
