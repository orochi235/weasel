/** Dragging a timeline's periods to reorder them, and editing its text in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import type { PlotDatum } from '../marks/types';
import { compileTimeline, timelineSlotAt } from './compile';
import { moveTimelinePeriod, setTimelineEvent, setTimelinePeriodLabel, setTimelineSectionName, timelinePeriodAt } from './edit';
import type { TimelineData } from './types';

/** The flat period index a period's box stands for, or `null` for any other mark. */
const periodOf = (datum: PlotDatum | undefined): number | null =>
  typeof datum?.period === 'number' && datum.event === undefined ? datum.period : null;

const numberOf = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** The text a datum names set to `text`; `data` itself for a datum naming nothing the timeline holds. */
function setText(data: TimelineData, datum: PlotDatum, text: string): TimelineData {
  const section = numberOf(datum.section);
  const period = numberOf(datum.period);
  const event = numberOf(datum.event);
  switch (datum.edit) {
    case 'title': return withTitle(data, text);
    case 'section': return section !== null && data.sections[section] !== undefined ? setTimelineSectionName(data, section, text) : data;
    case 'period': return period !== null && timelinePeriodAt(data, period) !== null ? setTimelinePeriodLabel(data, period, text) : data;
    case 'event': {
      const at = period === null ? null : timelinePeriodAt(data, period);
      const held = at !== null && event !== null && event >= 0 && event < data.sections[at.section]!.periods[at.index]!.events.length;
      return held ? setTimelineEvent(data, period!, event, text) : data;
    }
    default: return data;
  }
}

/** A period's box takes a press anywhere in it; a drag along x moves the period to the slot nearest the pointer. */
export const timelineEditor: PlotEditor<TimelineData> = {
  handle(_data, { trait, pose }) {
    if (trait.kind !== 'span' || periodOf(trait.datum) === null) return null;
    return { at: { x: pose.x + pose.width / 2, y: pose.y + pose.height / 2 }, cursor: 'ew-resize', box: pose };
  },
  drag(data, trait, size, theme, measure) {
    const from = periodOf(trait.datum);
    if (from === null || timelinePeriodAt(data, from) === null) return null;
    const { layout } = compileTimeline(data, size, theme, measure);
    return (at) => {
      const to = timelineSlotAt(layout, at.x);
      return to < 0 ? data : moveTimelinePeriod(data, from, to);
    };
  },
  text: setText,
};
