/** What a story declares to get a playhead. Times are in ms, as `@weasel-js/ui`'s timeline components take them. */
export interface TimelineSpec {
  /** How long the span runs. */
  duration: number;
  /** Where the span begins; below zero gives a lead-in before the story's zero. A fresh trial opens here. Default 0. */
  start?: number;
  /** Whether playing past the end wraps back to `start`. Default true. */
  loop?: boolean;
  /** Playback speed multiplier. Default 1. */
  rate?: number;
}

/** The span a playhead may stand in, in ms. */
export interface Span {
  start: number;
  end: number;
}

/** Everything a clock holds. */
export interface ClockState {
  /** The playhead, in ms, always inside `span`. */
  time: number;
  playing: boolean;
  loop: boolean;
  rate: number;
  span: Span;
}

/** A span replacing the declared one at runtime, as `StoryTimeline.setSpan` takes it. */
export type SpanOverride = Pick<TimelineSpec, 'duration' | 'start'>;

export function spanOf(spec: SpanOverride): Span {
  const start = Number.isFinite(spec.start) ? (spec.start as number) : 0;
  const duration = Number.isFinite(spec.duration) && spec.duration > 0 ? spec.duration : 0;
  return { start, end: start + duration };
}

export function clampTime(span: Span, t: number): number {
  if (Number.isNaN(t)) return span.start;
  return Math.min(span.end, Math.max(span.start, t));
}

/** `state` after `elapsed` ms of wall time. Past the end it wraps when looping, and otherwise stops there, paused. */
export function advance(state: ClockState, elapsed: number): ClockState {
  if (!state.playing) return state;
  const { start, end } = state.span;
  const length = end - start;
  if (length <= 0) return { ...state, time: start, playing: false };
  const next = state.time + elapsed * state.rate;
  if (next <= end) return { ...state, time: next };
  if (!state.loop) return { ...state, time: end, playing: false };
  return { ...state, time: start + ((next - start) % length) };
}

const validRate = (rate: number | undefined): rate is number => typeof rate === 'number' && Number.isFinite(rate) && rate > 0;

/** A story's clock: its state as an external store, and the moves the transport and the story make on it. */
export interface Clock {
  get(): ClockState;
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  setLoop(loop: boolean): void;
  setRate(rate: number): void;
  /** Replaces the declared span until called with null. */
  setSpan(span: SpanOverride | null): void;
  /** The story's declaration changed, as after an edit or a new config. Only its span is taken up. */
  declare(spec: TimelineSpec): void;
  /** Advances a playing clock by `elapsed` ms of wall time. */
  tick(elapsed: number): void;
}

/** A clock for `spec`, paused at `initial` when one is given and at the span start otherwise. */
export function createClock(spec: TimelineSpec, initial?: number | null): Clock {
  let declared = spanOf(spec);
  let override: Span | null = null;
  // Until something moves the playhead it follows the span's start, so a span set after mount still opens there.
  let homed = initial === undefined || initial === null;
  let state: ClockState = {
    time: homed ? declared.start : clampTime(declared, initial as number),
    playing: false,
    loop: spec.loop ?? true,
    rate: validRate(spec.rate) ? spec.rate : 1,
    span: declared,
  };
  const listeners = new Set<() => void>();

  const set = (next: ClockState): void => {
    if (
      next.time === state.time &&
      next.playing === state.playing &&
      next.loop === state.loop &&
      next.rate === state.rate &&
      next.span.start === state.span.start &&
      next.span.end === state.span.end
    )
      return;
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const moved = (next: ClockState): void => {
    homed = false;
    set(next);
  };
  const respan = (): void => {
    const span = override ?? declared;
    set({ ...state, span, time: homed ? span.start : clampTime(span, state.time) });
  };

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play() {
      if (state.playing) return;
      // Playing from the end starts over, as a player's play button does.
      moved({ ...state, playing: true, time: state.time >= state.span.end ? state.span.start : state.time });
    },
    pause: () => set({ ...state, playing: false }),
    seek: (time) => moved({ ...state, time: clampTime(state.span, time) }),
    setLoop: (loop) => set({ ...state, loop }),
    setRate(rate) {
      if (validRate(rate)) set({ ...state, rate });
    },
    setSpan(span) {
      override = span ? spanOf(span) : null;
      respan();
    },
    declare(next) {
      declared = spanOf(next);
      respan();
    },
    tick(elapsed) {
      if (state.playing) moved(advance(state, elapsed));
    },
  };
}
