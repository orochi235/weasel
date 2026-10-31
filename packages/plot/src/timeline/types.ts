/** One period on a timeline, and what happened in it. */
export interface TimelinePeriod {
  label: string;
  events: readonly string[];
}

/** A run of periods under one heading; the first may have none, holding the periods before any `section`. */
export interface TimelineSection {
  name?: string;
  periods: readonly TimelinePeriod[];
}

/** A timeline: periods left to right, each with its events stacked under it. */
export interface TimelineData {
  kind: 'timeline';
  title?: string;
  sections: readonly TimelineSection[];
}
