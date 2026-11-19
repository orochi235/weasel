import { node, param, type FakeNode, type FakeParam } from './fakeNode';

export interface FakeSource extends FakeNode {
  buffer: unknown;
  loop: boolean;
  playbackRate: FakeParam;
  detune: FakeParam;
  started: number[];
  /** The `offset` of each `start`, 0 when none was given. */
  offsets: number[];
  /** The `duration` of each `start`, in buffer seconds; Infinity when none was given. */
  durations: number[];
  stopped: number[];
  ended: boolean;
  onended: (() => void) | null;
  start(when?: number, offset?: number, duration?: number): void;
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

const requireStartTime = (when: number): void => {
  if (when < 0) throw new RangeError(`start time ${when} is negative`);
};

/** A buffer source whose `start` and `stop` default to `now()`. */
export function createFakeBufferSource(now: () => number): FakeSource {
  const s: FakeSource = node('source', {
    buffer: null as unknown,
    loop: false,
    playbackRate: param(1),
    detune: param(0),
    started: [] as number[],
    offsets: [] as number[],
    durations: [] as number[],
    stopped: [] as number[],
    ended: false,
    onended: null as (() => void) | null,
    start(when = now(), offset = 0, duration = Infinity) {
      if (s.started.length > 0) {
        throw new Error('InvalidStateError: start may only be called once');
      }
      requireStartTime(when);
      if (offset < 0) throw new RangeError(`start offset ${offset} is negative`);
      if (duration < 0) throw new RangeError(`start duration ${duration} is negative`);
      s.started.push(when);
      s.offsets.push(offset);
      s.durations.push(duration);
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
      requireStartTime(when);
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

/** When a buffer source runs out on its own: the buffer left past its offset
 *  (unless it loops), or the `duration` given to `start`, whichever is shorter,
 *  played at the current playback rate. A rate of 0 or less never runs out. */
function runsOutAt(s: FakeSource): number {
  const length = (s.buffer as { duration?: number } | null)?.duration;
  const left = s.loop || length == null ? Infinity : Math.max(0, length - s.offsets[0]);
  const content = Math.min(left, s.durations[0]);
  const rate = s.playbackRate.value;
  if (content === Infinity || rate <= 0) return Infinity;
  return s.started[0] + content / rate;
}

/**
 * Whether a started source has reached its end by `now`: its last `stop` (the
 * specification lets a later call replace an earlier one), or the end of what
 * a buffer source was given to play.
 */
export function dueToEnd(s: FakeSource | FakeOscillator, now: number): boolean {
  if (s.ended || s.started.length === 0) return false;
  const stopAt = s.stopped.length > 0 ? s.stopped[s.stopped.length - 1] : Infinity;
  const endsAt = 'buffer' in s ? runsOutAt(s) : Infinity;
  return now + 1e-9 >= Math.min(stopAt, endsAt);
}
