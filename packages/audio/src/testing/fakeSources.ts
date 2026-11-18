import { node, param, type FakeNode, type FakeParam } from './fakeNode';

export interface FakeSource extends FakeNode {
  buffer: unknown;
  loop: boolean;
  playbackRate: FakeParam;
  detune: FakeParam;
  started: number[];
  /** The `offset` of each `start`, 0 when none was given. */
  offsets: number[];
  stopped: number[];
  ended: boolean;
  onended: (() => void) | null;
  start(when?: number, offset?: number): void;
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

/** A buffer source whose `start` and `stop` default to `now()`. */
export function createFakeBufferSource(now: () => number): FakeSource {
  const s: FakeSource = node('source', {
    buffer: null as unknown,
    loop: false,
    playbackRate: param(1),
    detune: param(0),
    started: [] as number[],
    offsets: [] as number[],
    stopped: [] as number[],
    ended: false,
    onended: null as (() => void) | null,
    start(when = now(), offset = 0) {
      if (s.started.length > 0) {
        throw new Error('InvalidStateError: start may only be called once');
      }
      s.started.push(when);
      s.offsets.push(offset);
    },
    stop(when = now()) {
      if (s.started.length === 0) {
        throw new Error('InvalidStateError: stop called before start');
      }
      s.stopped.push(when);
    },
  });
  return s;
}

/** An oscillator whose `start` and `stop` default to `now()`. */
export function createFakeOscillator(now: () => number): FakeOscillator {
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
    start(when = now()) {
      if (o.started.length > 0) {
        throw new Error('InvalidStateError: start may only be called once');
      }
      o.started.push(when);
    },
    stop(when = now()) {
      if (o.started.length === 0) {
        throw new Error('InvalidStateError: stop called before start');
      }
      o.stopped.push(when);
    },
  });
  return o;
}

/**
 * Whether a started source has reached its end by `now`: its last `stop` (the
 * specification lets a later call replace an earlier one), or the end of a
 * non-looping buffer.
 */
export function dueToEnd(s: FakeSource | FakeOscillator, now: number): boolean {
  if (s.ended || s.started.length === 0) return false;
  const stopAt = s.stopped.length > 0 ? s.stopped[s.stopped.length - 1] : Infinity;
  const duration = 'buffer' in s ? (s.buffer as { duration?: number } | null)?.duration : undefined;
  const endsAt = 'buffer' in s && !s.loop && duration != null ? s.started[0] + duration : Infinity;
  return now + 1e-9 >= Math.min(stopAt, endsAt);
}
