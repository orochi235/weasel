/** A timeline as a table of sections, under each a table of periods, and under each period a table of its events. */
import { textOf, titleField } from '../editing/schemaKit';
import type { PlotSchema, PlotScope } from '../editing/schemaTypes';
import { setTimelineEvent, setTimelinePeriodLabel, setTimelineSectionName } from './edit';
import {
  insertTimelineEvent, insertTimelinePeriod, insertTimelineSection, moveTimelineEvent, moveTimelineSection, removeTimelineEvent,
  removeTimelinePeriod, removeTimelineSection, reorderTimelinePeriod, timelineFlatIndex,
} from './structure';
import type { TimelineData, TimelinePeriod } from './types';

const periodOf = (d: TimelineData, section: number, period: number): TimelinePeriod | undefined => d.sections[section]?.periods[period];
const at = (s: PlotScope): [number, number] => [s[0]!, s[1]!];

export const timelineSchema: PlotSchema<TimelineData> = {
  fields: [titleField()],
  tables: [{
    key: 'sections', label: 'Sections', item: 'section',
    count: (d) => d.sections.length,
    columns: () => [{
      key: 'name', label: 'Section', type: { kind: 'string' },
      get: (d, _, r) => d.sections[r]?.name,
      set: (d, _, r, v) => setTimelineSectionName(d, r, textOf(v) ?? ''),
    }],
    insert: (d, _, i) => insertTimelineSection(d, i),
    remove: (d, _, r) => removeTimelineSection(d, r),
    move: (d, _, from, to) => moveTimelineSection(d, from, to),
    rowLabel: (d, _, r) => d.sections[r]?.name ?? 'Untitled section',
    children: [{
      key: 'periods', label: 'Periods', item: 'period',
      count: (d, s) => d.sections[s[0]!]?.periods.length ?? 0,
      columns: () => [{
        key: 'label', label: 'Period', type: { kind: 'string' },
        get: (d, s, r) => periodOf(d, s[0]!, r)?.label,
        set: (d, s, r, v) => setTimelinePeriodLabel(d, timelineFlatIndex(d, s[0]!, r), textOf(v) ?? ''),
      }],
      insert: (d, s, i) => insertTimelinePeriod(d, s[0]!, i),
      remove: (d, s, r) => removeTimelinePeriod(d, s[0]!, r),
      move: (d, s, from, to) => reorderTimelinePeriod(d, s[0]!, from, to),
      rowLabel: (d, s, r) => periodOf(d, s[0]!, r)?.label ?? '',
      children: [{
        key: 'events', label: 'Events', item: 'event',
        count: (d, s) => periodOf(d, ...at(s))?.events.length ?? 0,
        columns: () => [{
          key: 'text', label: 'Event', type: { kind: 'string' },
          get: (d, s, r) => periodOf(d, ...at(s))?.events[r],
          set: (d, s, r, v) => {
            const text = textOf(v)?.trim();
            return text ? setTimelineEvent(d, timelineFlatIndex(d, ...at(s)), r, text) : d;
          },
        }],
        insert: (d, s, i) => insertTimelineEvent(d, ...at(s), i),
        remove: (d, s, r) => removeTimelineEvent(d, ...at(s), r),
        move: (d, s, from, to) => moveTimelineEvent(d, ...at(s), from, to),
      }],
    }],
  }],
};
