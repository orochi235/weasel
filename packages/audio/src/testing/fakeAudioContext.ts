/** Minimal Web Audio double. Records connections and calls so tests can assert
 *  graph shape and scheduling without a browser. Not a spec implementation —
 *  it covers exactly the surface `createAudioEngine` touches. */

export interface FakeParam { value: number; ramps: { value: number; at: number }[] }

const param = (value: number): FakeParam => ({
  value,
  ramps: [],
});

export interface FakeNode {
  kind: string;
  connectedTo: FakeNode[];
  disconnected: boolean;
  connect(target: FakeNode): FakeNode;
  disconnect(): void;
}

function node(kind: string, extra: Record<string, unknown> = {}): FakeNode & Record<string, unknown> {
  const n = {
    kind,
    connectedTo: [] as FakeNode[],
    disconnected: false,
    connect(target: FakeNode) { n.connectedTo.push(target); return target; },
    disconnect() { n.disconnected = true; },
    ...extra,
  } as FakeNode & Record<string, unknown>;
  return n;
}

export interface FakeAudioContext {
  state: 'suspended' | 'running' | 'closed';
  currentTime: number;
  destination: FakeNode;
  resume(): Promise<void>;
  createGain(): FakeNode & { gain: FakeParam };
  createStereoPanner(): FakeNode & { pan: FakeParam };
  createAnalyser(): FakeNode & { fftSize: number; frequencyBinCount: number;
    getByteFrequencyData(a: Uint8Array): void; getByteTimeDomainData(a: Uint8Array): void };
  createBufferSource(): FakeNode & { buffer: unknown; loop: boolean;
    playbackRate: FakeParam; detune: FakeParam;
    started: number[]; stopped: number[];
    start(when?: number): void; stop(when?: number): void;
    onended: (() => void) | null };
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  /** Test hook: advance the audio clock. */
  _advance(ms: number): void;
  /** Test hook: every source node created, in order. */
  _sources: (FakeNode & { started: number[] })[];
  /** Test hook: canned analyser output. */
  _analyserBytes: number;
}

export function createFakeAudioContext(): FakeAudioContext {
  const sources: (FakeNode & { started: number[] })[] = [];
  const ctx: FakeAudioContext = {
    state: 'suspended',
    currentTime: 0,
    destination: node('destination'),
    async resume() { ctx.state = 'running'; },
    createGain: () => node('gain', { gain: param(1) }) as FakeNode & { gain: FakeParam },
    createStereoPanner: () => node('panner', { pan: param(0) }) as FakeNode & { pan: FakeParam },
    createAnalyser: () => node('analyser', {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData(a: Uint8Array) { a.fill(ctx._analyserBytes); },
      getByteTimeDomainData(a: Uint8Array) { a.fill(ctx._analyserBytes); },
    }) as never,
    createBufferSource() {
      const s = node('source', {
        buffer: null,
        loop: false,
        playbackRate: param(1),
        detune: param(0),
        started: [] as number[],
        stopped: [] as number[],
        onended: null,
        start(when = 0) { (s as never as { started: number[] }).started.push(when); },
        stop(when = 0) { (s as never as { stopped: number[] }).stopped.push(when); },
      }) as never as FakeNode & { started: number[] };
      sources.push(s);
      return s as never;
    },
    async decodeAudioData() { return { duration: 1 }; },
    _advance(ms) { ctx.currentTime += ms / 1000; },
    _sources: sources,
    _analyserBytes: 128,
  };
  return ctx;
}
