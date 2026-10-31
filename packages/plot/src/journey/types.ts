/** One step of a journey: how it went, 1 to 5, and who took part. */
export interface JourneyTask {
  name: string;
  /** A whole number, 1 to 5. */
  score: number;
  actors: readonly string[];
}

/** A run of steps under one heading; the first may have none, holding the steps before any `section`. */
export interface JourneySection {
  name?: string;
  tasks: readonly JourneyTask[];
}

/** A user journey: steps left to right in sections, each scored 1 to 5. */
export interface JourneyData {
  kind: 'journey';
  title?: string;
  sections: readonly JourneySection[];
}
