import { describe, expect, it } from 'vitest';
import { handlesOf } from '../editing/editors';
import { PLOT_THEME, seriesColor } from '../theme';
import { compileTimeline, timelineSlotAt } from './compile';
import { moveTimelinePeriod, setTimelineEvent, setTimelinePeriodLabel, setTimelineSectionName, timelinePeriodAt } from './edit';
import { timelineEditor } from './editor';
import type { TimelineData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 600, height: 400 };

const HISTORY: TimelineData = {
  kind: 'timeline',
  title: 'History',
  sections: [
    { periods: [{ label: '2002', events: ['LinkedIn'] }] },
    { name: 'Rise', periods: [{ label: '2004', events: ['Facebook', 'Google'] }, { label: '2005', events: ['YouTube'] }] },
    { name: 'Later', periods: [{ label: '2006', events: [] }] },
  ],
};

const byKey = (data: TimelineData) => {
  const { marks, layout } = compileTimeline(data, SIZE, PLOT_THEME, measure);
  return { marks, layout, get: (key: string) => marks.find((m) => m.key === key) };
};

describe('compileTimeline', () => {
  it('lays periods left to right in equal columns, each label in a box of its section\'s color', () => {
    const { layout, get } = byKey(HISTORY);
    expect(layout.slots).toHaveLength(4);
    expect(layout.slots[1]! - layout.slots[0]!).toBeCloseTo(layout.columnWidth);
    const label = get('period:1:label')!;
    expect(label.data.text).toBe('2004');
    expect(label.data.plotMark.datum).toEqual({ edit: 'period', period: 1 });
    expect(label.pose.x + label.pose.width / 2).toBeCloseTo(layout.slots[1]!);
    expect(get('period:0:box')!.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 0));
    expect(get('period:2:box')!.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 1));
    expect(get('period:3:box')!.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 2));
  });

  it('stacks each period\'s events below the line, in order', () => {
    const { get } = byKey(HISTORY);
    const [a, b] = [get('event:1:0:label')!, get('event:1:1:label')!];
    expect([a.data.text, b.data.text]).toEqual(['Facebook', 'Google']);
    expect(b.pose.y).toBeGreaterThan(a.pose.y);
    expect(a.data.plotMark.datum).toEqual({ edit: 'event', period: 1, event: 0 });
    expect(a.pose.y).toBeGreaterThan(get('line')!.pose.y);
    expect(get('period:1:box')!.pose.y + get('period:1:box')!.pose.height).toBeLessThan(get('line')!.pose.y);
  });

  it('heads each named section over its run of periods, and none over the periods before the first', () => {
    const { layout, get } = byKey(HISTORY);
    const header = get('section:1:label')!;
    expect(header.data.text).toBe('Rise');
    expect(header.data.plotMark.datum).toEqual({ edit: 'section', section: 1 });
    expect(header.pose.x + header.pose.width / 2).toBeCloseTo((layout.slots[1]! + layout.slots[2]!) / 2);
    const band = get('section:1:band')!;
    expect(band.pose.x).toBeCloseTo(layout.slots[1]! - layout.columnWidth / 2);
    expect(band.pose.width).toBeCloseTo(2 * layout.columnWidth);
    expect(get('section:0:label')).toBeUndefined();
    expect(get('title')!.data.text).toBe('History');
  });

  it('keeps every key unique, and draws nothing but the title for an empty timeline in a tiny box', () => {
    const { marks } = byKey(HISTORY);
    expect(new Set(marks.map((m) => m.key)).size).toBe(marks.length);
    const tiny = compileTimeline({ kind: 'timeline', sections: [] }, { width: 2, height: 2 }, PLOT_THEME, measure);
    expect(tiny.marks).toEqual([]);
    expect(timelineSlotAt(tiny.layout, 10)).toBe(-1);
  });
});

describe('timeline edits', () => {
  it('locates a flat period index', () => {
    expect(timelinePeriodAt(HISTORY, 2)).toEqual({ section: 1, index: 1 });
    expect(timelinePeriodAt(HISTORY, 4)).toBeNull();
  });

  it('sets labels, section names and events, an empty event removed', () => {
    expect(setTimelinePeriodLabel(HISTORY, 2, ' 2005a ').sections[1]!.periods[1]!.label).toBe('2005a');
    expect(setTimelinePeriodLabel(HISTORY, 2, '')).toBe(HISTORY);
    expect(setTimelineSectionName(HISTORY, 2, 'Now').sections[2]!.name).toBe('Now');
    expect(setTimelineSectionName(HISTORY, 2, 'Later')).toBe(HISTORY);
    expect(setTimelineEvent(HISTORY, 1, 1, 'Alphabet').sections[1]!.periods[0]!.events).toEqual(['Facebook', 'Alphabet']);
    expect(setTimelineEvent(HISTORY, 1, 0, '  ').sections[1]!.periods[0]!.events).toEqual(['Google']);
    expect(() => setTimelineEvent(HISTORY, 3, 0, 'x')).toThrow(/no event 0/);
    expect(() => setTimelinePeriodLabel(HISTORY, 9, 'x')).toThrow(/no period 9/);
  });

  it('moves a period, joining the section it lands in and dropping one left empty', () => {
    const right = moveTimelinePeriod(HISTORY, 0, 1);
    expect(right.sections.map((s) => [s.name, s.periods.map((p) => p.label)])).toEqual([
      ['Rise', ['2004', '2002', '2005']], ['Later', ['2006']],
    ]);
    const left = moveTimelinePeriod(HISTORY, 3, 0);
    expect(left.sections.map((s) => [s.name, s.periods.map((p) => p.label)])).toEqual([
      [undefined, ['2006', '2002']], ['Rise', ['2004', '2005']],
    ]);
    const within = moveTimelinePeriod(HISTORY, 1, 2);
    expect(within.sections[1]!.periods.map((p) => p.label)).toEqual(['2005', '2004']);
    expect(moveTimelinePeriod(HISTORY, 2, 2)).toBe(HISTORY);
    expect(() => moveTimelinePeriod(HISTORY, 0, 4)).toThrow(/no period 4/);
  });
});

describe('the timeline editor', () => {
  it('puts a box handle on each period\'s box and none elsewhere; a drag drops at the nearest slot', () => {
    const { layout, get } = byKey(HISTORY);
    const box = get('period:0:box')!;
    const [handle] = handlesOf(timelineEditor.handle(HISTORY, { trait: box.data.plotMark, pose: box.pose }));
    expect(handle).toMatchObject({ cursor: 'ew-resize', box: box.pose });
    const event = get('event:1:0:box')!;
    expect(timelineEditor.handle(HISTORY, { trait: event.data.plotMark, pose: event.pose })).toBeNull();
    const drag = timelineEditor.drag(HISTORY, box.data.plotMark, SIZE, PLOT_THEME, measure)!;
    expect(drag({ x: layout.slots[2]! + 5, y: 0 }).sections[0]!.periods.map((p) => p.label)).toEqual(['2004', '2005', '2002']);
    expect(drag({ x: layout.slots[0]!, y: 0 })).toBe(HISTORY);
  });

  it('edits text in place by its datum', () => {
    const text = timelineEditor.text!;
    expect(text(HISTORY, { edit: 'title' }, 'Social').title).toBe('Social');
    expect(text(HISTORY, { edit: 'section', section: 1 }, 'Boom').sections[1]!.name).toBe('Boom');
    expect(text(HISTORY, { edit: 'period', period: 3 }, '2007').sections[2]!.periods[0]!.label).toBe('2007');
    expect(text(HISTORY, { edit: 'event', period: 0, event: 0 }, '').sections[0]!.periods[0]!.events).toEqual([]);
    expect(text(HISTORY, { edit: 'event', period: 0, event: 5 }, 'x')).toBe(HISTORY);
    expect(text(HISTORY, { edit: 'other' }, 'x')).toBe(HISTORY);
  });
});
