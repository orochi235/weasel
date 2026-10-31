import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import {
  insertTimelineEvent, insertTimelinePeriod, insertTimelineSection, moveTimelineEvent, moveTimelineSection, removeTimelineEvent,
  removeTimelinePeriod, removeTimelineSection, reorderTimelinePeriod, timelineFlatIndex,
} from './structure';
import type { TimelineData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: TimelineData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);

const T: TimelineData = {
  kind: 'timeline',
  sections: [
    { name: 'A', periods: [{ label: '2001', events: ['x', 'y'] }, { label: '2002', events: [] }] },
    { name: 'B', periods: [{ label: '2003', events: ['z'] }] },
  ],
};

describe('timeline structure', () => {
  it('builds a timeline from nothing: a section, periods, events', () => {
    let d = insertTimelineSection({ kind: 'timeline', sections: [] }, 0);
    d = insertTimelinePeriod(d, 0, 1);
    d = insertTimelineEvent(insertTimelineEvent(d, 0, 1, 0), 0, 1, 0, 'first');
    expect(d.sections).toEqual([{ name: 'Section 1', periods: [{ label: 'Period 1', events: [] }, { label: 'Period 2', events: ['first', 'Event 1'] }] }]);
    compiles(d);
  });

  it('moves and removes sections, periods and events', () => {
    expect(moveTimelineSection(T, 1, 0).sections.map((s) => s.name)).toEqual(['B', 'A']);
    expect(removeTimelineSection(T, 0).sections.map((s) => s.name)).toEqual(['B']);
    expect(reorderTimelinePeriod(T, 0, 0, 1).sections[0]!.periods.map((p) => p.label)).toEqual(['2002', '2001']);
    expect(removeTimelinePeriod(T, 0, 1).sections[0]!.periods.map((p) => p.label)).toEqual(['2001']);
    expect(moveTimelineEvent(T, 0, 0, 1, 0).sections[0]!.periods[0]!.events).toEqual(['y', 'x']);
    expect(removeTimelineEvent(T, 0, 0, 0).sections[0]!.periods[0]!.events).toEqual(['y']);
    expect(() => removeTimelineEvent(T, 0, 1, 0)).toThrow(/no item 0/);
    compiles(removeTimelineSection(T, 1));
  });

  it('counts a period flat across sections', () => {
    expect(timelineFlatIndex(T, 1, 0)).toBe(2);
    expect(() => timelineFlatIndex(T, 1, 1)).toThrow(/no period 1/);
  });
});
