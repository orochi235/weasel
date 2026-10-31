/** Edits to a timeline's sections, periods, and events as collections, as plain data in and out. A period is named by
 *  its section and its place in it. */
import { freshName, insertAt, moveAt, removeAt, updateAt } from '../editing/lists';
import type { TimelineData, TimelinePeriod, TimelineSection } from './types';

/** The flat index, counted across every section, of period `index` of section `section`. */
export function timelineFlatIndex(data: TimelineData, section: number, index: number): number {
  if (data.sections[section]?.periods[index] === undefined) throw new Error(`timelineFlatIndex: section ${section} holds no period ${index}`);
  return data.sections.slice(0, section).reduce((n, s) => n + s.periods.length, 0) + index;
}

const allLabels = (data: TimelineData): string[] => data.sections.flatMap((s) => s.periods.map((p) => p.label));

const freshPeriod = (data: TimelineData): TimelinePeriod => {
  const labels = allLabels(data);
  return { label: freshName('Period', labels, labels.length + 1), events: [] };
};

/** `data` with `section` inserted before section `at`; absent, one fresh period under a fresh name. */
export function insertTimelineSection(data: TimelineData, at: number, section?: TimelineSection): TimelineData {
  const next = section ?? {
    name: freshName('Section', data.sections.flatMap((s) => (s.name === undefined ? [] : [s.name])), data.sections.length + 1),
    periods: [freshPeriod(data)],
  };
  return { ...data, sections: insertAt(data.sections, at, next, 'insertTimelineSection') };
}

/** `data` without section `section` and its periods. Throws on a section it does not hold. */
export const removeTimelineSection = (data: TimelineData, section: number): TimelineData =>
  ({ ...data, sections: removeAt(data.sections, section, 'removeTimelineSection') });

/** `data` with section `from` moved to index `to`, counted once it is taken out. */
export const moveTimelineSection = (data: TimelineData, from: number, to: number): TimelineData =>
  (from === to ? data : { ...data, sections: moveAt(data.sections, from, to, 'moveTimelineSection') });

const withPeriods = (data: TimelineData, section: number, change: (p: readonly TimelinePeriod[]) => TimelinePeriod[], who: string): TimelineData =>
  ({ ...data, sections: updateAt(data.sections, section, (s) => ({ ...s, periods: change(s.periods) }), who) });

/** `data` with `period` inserted before period `at` of section `section`; absent, a fresh period with no events. */
export const insertTimelinePeriod = (data: TimelineData, section: number, at: number, period?: TimelinePeriod): TimelineData =>
  withPeriods(data, section, (ps) => insertAt(ps, at, period ?? freshPeriod(data), 'insertTimelinePeriod'), 'insertTimelinePeriod');

/** `data` without period `period` of section `section`. Throws on a period it does not hold. */
export const removeTimelinePeriod = (data: TimelineData, section: number, period: number): TimelineData =>
  withPeriods(data, section, (ps) => removeAt(ps, period, 'removeTimelinePeriod'), 'removeTimelinePeriod');

/** `data` with period `from` of section `section` moved to index `to` in it, counted once it is taken out. */
export const reorderTimelinePeriod = (data: TimelineData, section: number, from: number, to: number): TimelineData =>
  (from === to ? data : withPeriods(data, section, (ps) => moveAt(ps, from, to, 'reorderTimelinePeriod'), 'reorderTimelinePeriod'));

const withEvents = (
  data: TimelineData, section: number, period: number, change: (e: readonly string[]) => string[], who: string,
): TimelineData => withPeriods(data, section, (ps) => updateAt(ps, period, (p) => ({ ...p, events: change(p.events) }), who), who);

/** `data` with event `text` inserted before event `at` of one period; absent, a fresh one. */
export const insertTimelineEvent = (data: TimelineData, section: number, period: number, at: number, text?: string): TimelineData =>
  withEvents(data, section, period, (es) => insertAt(es, at, text ?? freshName('Event', es, es.length + 1), 'insertTimelineEvent'), 'insertTimelineEvent');

/** `data` without event `event` of one period. Throws on an event it does not hold. */
export const removeTimelineEvent = (data: TimelineData, section: number, period: number, event: number): TimelineData =>
  withEvents(data, section, period, (es) => removeAt(es, event, 'removeTimelineEvent'), 'removeTimelineEvent');

/** `data` with event `from` of one period moved to index `to` in it, counted once it is taken out. */
export const moveTimelineEvent = (data: TimelineData, section: number, period: number, from: number, to: number): TimelineData =>
  (from === to ? data : withEvents(data, section, period, (es) => moveAt(es, from, to, 'moveTimelineEvent'), 'moveTimelineEvent'));
