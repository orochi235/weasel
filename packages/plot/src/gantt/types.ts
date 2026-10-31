/** A tag on a task: finished, under way, on the critical path, or a milestone drawn as a diamond at its start. */
export type GanttTag = 'done' | 'active' | 'crit' | 'milestone';

/** Where a task starts: a date written in the chart's `dateFormat`, when the last of some tasks ends, or (absent
 *  both) when the task before it ends. */
export type GanttStart =
  | { kind: 'date'; date: string }
  | { kind: 'after'; ids: readonly string[] }
  | { kind: 'previous' };

/** A unit a duration counts in: milliseconds to weeks, or calendar months and years. */
export type GanttUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'M' | 'y';

/** Where a task ends: a date in the chart's `dateFormat`, a length from its start (days skip excluded days), or
 *  when the first of some tasks starts. */
export type GanttEnd =
  | { kind: 'date'; date: string }
  | { kind: 'duration'; amount: number; unit: GanttUnit }
  | { kind: 'until'; ids: readonly string[] };

/** One task. Its start and end are stored as written, so a task after another moves with it. */
export interface GanttTask {
  name: string;
  /** What `after` and `until` name it by. */
  id?: string;
  tags?: readonly GanttTag[];
  start: GanttStart;
  end: GanttEnd;
}

/** A run of tasks under one heading; the first may have none, holding the tasks before any `section`. */
export interface GanttSection {
  name?: string;
  tasks: readonly GanttTask[];
}

/** A Gantt chart: tasks in sections, laid on a time axis. */
export interface GanttData {
  kind: 'gantt';
  title?: string;
  /** How dates are written, in Day.js tokens. Default `'YYYY-MM-DD'`. */
  dateFormat?: string;
  /** How the axis writes dates, in strftime tokens (`%Y-%m-%d`). Default the time scale's own. */
  axisFormat?: string;
  /** Days a duration in days skips: `'weekends'`, a weekday name (`'sunday'`), or a date in `dateFormat`. */
  excludes?: readonly string[];
  /** `'off'` hides the line at today; anything else is its style, as written. Default a line at today. */
  todayMarker?: string;
  sections: readonly GanttSection[];
}
