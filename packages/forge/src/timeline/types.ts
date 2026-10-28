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

/** A span replacing the declared one at runtime, as `StoryTimeline.setSpan` takes it. */
export type SpanOverride = Pick<TimelineSpec, 'duration' | 'start'>;
