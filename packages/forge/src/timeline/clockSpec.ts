import type { ClockSpec } from '@weasel-js/clock';
import type { SpanOverride, TimelineSpec } from './types';

const positive = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** A span's length, in ms: anything not a positive finite number stands as 1 ms, so a timeline can never throw. */
const lengthOf = (duration: number): number => (positive(duration) ? duration : 1);

const startOf = (start: number | undefined): number => (typeof start === 'number' && Number.isFinite(start) ? start : 0);

/** The clock a story's timeline declares. It opens paused at the span's start, and loops unless told not to. */
export function clockSpecOf(spec: TimelineSpec): ClockSpec {
  return {
    duration: lengthOf(spec.duration),
    origin: startOf(spec.start),
    loop: spec.loop ?? true,
    speed: positive(spec.rate) ? spec.rate : 1,
  };
}

/** The clock override a story's `setSpan` asks for. */
export function spanOverrideOf(span: SpanOverride): { duration: number; origin: number } {
  return { duration: lengthOf(span.duration), origin: startOf(span.start) };
}
