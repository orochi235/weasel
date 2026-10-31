/** A timeline compiled to its marks: periods in columns, each section a colored header over its run. */
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { pointMark, spanMark } from '../marks/boxes';
import { ruleMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { seriesColor, type PlotTheme } from '../theme';
import { timelineLength } from './edit';
import type { TimelineData } from './types';

/** Where a timeline's columns landed: one per period, counted flat across sections. */
export interface TimelineLayout {
  /** Each period's column center along x. */
  slots: readonly number[];
  columnWidth: number;
}

const BOX_PAD = 6;
const INSET = 4;
const GAP = 8;
const LINE_GAP = 14;
const EVENT_GAP = 6;

/** Lays out a timeline in a box of `size`: its title, section headers, period boxes, the line across, and events. */
export function compileTimeline(
  data: TimelineData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: TimelineLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const n = timelineLength(data);
  const columnWidth = Math.max(1, size.width - 2 * PAD) / Math.max(1, n);
  const slots = Array.from({ length: n }, (_, i) => PAD + columnWidth * (i + 0.5));
  const boxHeight = measure('Mg', theme.font).height + 2 * BOX_PAD;
  const named = data.sections.some((s) => s.name !== undefined);
  const periodTop = top + (named ? boxHeight + GAP : 0);
  const lineY = periodTop + boxHeight + LINE_GAP;
  const bottom = Math.max(lineY, size.height - PAD);
  const font = { font: theme.font, color: theme.text, measure };
  const boxes: PlotMark[] = [];
  const texts: PlotMark[] = [];
  let p = 0;
  data.sections.forEach((section, s) => {
    const color = seriesColor(theme, s);
    const first = p;
    for (const period of section.periods) {
      const x = PAD + columnWidth * p + INSET;
      const width = Math.max(1, columnWidth - 2 * INSET);
      boxes.push(spanMark({ key: `period:${p}:box`, x0: x, x1: x + width, y: periodTop, height: boxHeight, color, datum: { period: p } }));
      texts.push(textMark({ key: `period:${p}:label`, text: period.label, x: slots[p]!, y: periodTop + boxHeight / 2, ...font, bold: true, datum: { edit: 'period', period: p } }));
      boxes.push(ruleMark({ key: `period:${p}:stem`, from: { x: slots[p]!, y: lineY }, to: { x: slots[p]!, y: lineY + LINE_GAP }, color, dash: [3, 3] }));
      let y = lineY + LINE_GAP;
      period.events.forEach((event, e) => {
        boxes.push(spanMark({ key: `event:${p}:${e}:box`, x0: x, x1: x + width, y, height: boxHeight, color, opacity: 0.35, datum: { period: p, event: e } }));
        texts.push(textMark({ key: `event:${p}:${e}:label`, text: event, x: slots[p]!, y: y + boxHeight / 2, ...font, datum: { edit: 'event', period: p, event: e } }));
        y += boxHeight + EVENT_GAP;
      });
      p++;
    }
    if (section.name === undefined || p === first) return;
    const x0 = PAD + columnWidth * first;
    const x1 = PAD + columnWidth * p;
    marks.push(spanMark({ key: `section:${s}:band`, x0, x1, y: top, height: bottom - top, color, opacity: 0.12, datum: { section: s } }));
    boxes.push(spanMark({ key: `section:${s}:header`, x0: x0 + INSET, x1: x1 - INSET, y: top, height: boxHeight, color, datum: { section: s } }));
    texts.push(textMark({ key: `section:${s}:label`, text: section.name, x: (x0 + x1) / 2, y: top + boxHeight / 2, ...font, bold: true, datum: { edit: 'section', section: s } }));
  });
  if (n > 0) marks.push(ruleMark({ key: 'line', from: { x: PAD, y: lineY }, to: { x: size.width - PAD, y: lineY }, color: theme.axis, width: 2 }));
  marks.push(...boxes);
  slots.forEach((x, i) => marks.push(pointMark({ key: `period:${i}:dot`, x, y: lineY, radius: 4, color: theme.axis, datum: { period: i } })));
  marks.push(...texts);
  return { marks, layout: { slots, columnWidth } };
}

/** The period slot nearest `x`; `-1` when there are none. */
export function timelineSlotAt(layout: TimelineLayout, x: number): number {
  let best = -1;
  layout.slots.forEach((slot, i) => {
    if (best < 0 || Math.abs(slot - x) < Math.abs(layout.slots[best]! - x)) best = i;
  });
  return best;
}
