/** Edits to a timeline, as plain data in and out. Periods are counted flat, left to right across every section. */
import type { TimelineData, TimelinePeriod, TimelineSection } from './types';

/** Where the `period`th period, counted flat, sits: its section and its place in it; `null` past the last. */
export function timelinePeriodAt(data: TimelineData, period: number): { section: number; index: number } | null {
  if (!Number.isInteger(period) || period < 0) return null;
  let left = period;
  for (let s = 0; s < data.sections.length; s++) {
    const n = data.sections[s]!.periods.length;
    if (left < n) return { section: s, index: left };
    left -= n;
  }
  return null;
}

/** How many periods the timeline holds across its sections. */
export const timelineLength = (data: TimelineData): number => data.sections.reduce((n, s) => n + s.periods.length, 0);

function locate(data: TimelineData, period: number, what: string): { section: number; index: number } {
  const at = timelinePeriodAt(data, period);
  if (at === null) throw new Error(`${what}: the timeline holds no period ${period}`);
  return at;
}

/** `data` with one period replaced by `next`. */
function withPeriod(data: TimelineData, at: { section: number; index: number }, next: TimelinePeriod): TimelineData {
  return {
    ...data,
    sections: data.sections.map((s, i) => (i === at.section ? { ...s, periods: s.periods.map((p, j) => (j === at.index ? next : p)) } : s)),
  };
}

/** `data` with section `section` named `name`, trimmed. An empty name changes nothing. Throws on a section it does not hold. */
export function setTimelineSectionName(data: TimelineData, section: number, name: string): TimelineData {
  const target = data.sections[section];
  if (target === undefined) throw new Error(`setTimelineSectionName: the timeline holds no section ${section}`);
  const text = name.trim();
  if (text === '' || text === target.name) return data;
  return { ...data, sections: data.sections.map((s, i) => (i === section ? { ...s, name: text } : s)) };
}

/** `data` with period `period`'s label set to `label`, trimmed. An empty label changes nothing. */
export function setTimelinePeriodLabel(data: TimelineData, period: number, label: string): TimelineData {
  const at = locate(data, period, 'setTimelinePeriodLabel');
  const target = data.sections[at.section]!.periods[at.index]!;
  const text = label.trim();
  if (text === '' || text === target.label) return data;
  return withPeriod(data, at, { ...target, label: text });
}

/** `data` with event `event` of period `period` set to `text`, trimmed; an empty one removes the event. */
export function setTimelineEvent(data: TimelineData, period: number, event: number, text: string): TimelineData {
  const at = locate(data, period, 'setTimelineEvent');
  const target = data.sections[at.section]!.periods[at.index]!;
  if (!Number.isInteger(event) || event < 0 || event >= target.events.length) {
    throw new Error(`setTimelineEvent: period ${period} holds no event ${event}`);
  }
  const value = text.trim();
  if (value === target.events[event]) return data;
  const events = value === '' ? target.events.filter((_, i) => i !== event) : target.events.map((e, i) => (i === event ? value : e));
  return withPeriod(data, at, { ...target, events });
}

/**
 * `data` with the period at flat index `from` moved to flat index `to`, counted after it is taken out. Moved right,
 * it joins the section of the period before it; moved left, the section of the period after it. A section the move
 * leaves empty is dropped. Throws on an index the timeline does not hold.
 */
export function moveTimelinePeriod(data: TimelineData, from: number, to: number): TimelineData {
  const n = timelineLength(data);
  locate(data, from, 'moveTimelinePeriod');
  if (!Number.isInteger(to) || to < 0 || to >= n) throw new Error(`moveTimelinePeriod: the timeline holds no period ${to}`);
  if (from === to) return data;
  const flat = data.sections.flatMap((s, section) => s.periods.map((period) => ({ section, period })));
  const [moved] = flat.splice(from, 1);
  const neighbor = to > from ? flat[to - 1]! : flat[to]!;
  flat.splice(to, 0, { section: neighbor.section, period: moved!.period });
  const sections: TimelineSection[] = [];
  data.sections.forEach((s, i) => {
    const periods = flat.filter((f) => f.section === i).map((f) => f.period);
    if (periods.length > 0) sections.push({ ...s, periods });
  });
  return { ...data, sections };
}
