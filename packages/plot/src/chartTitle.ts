/** A chart's title: one bold line across its top, which a text edit sets. Every kind draws its title this way. */
import { textMark } from './marks/text';
import type { PlotMark } from './marks/types';
import type { PlotMeasure } from './measure';
import type { PlotTheme } from './theme';

/** The room every chart leaves around its edge. */
export const CHART_PAD = 12;
const GAP = 8;

/** `title` centered across the top of a box `width` wide, keyed `title`, and where the rest of the chart starts below
 *  it: {@link CHART_PAD} down when there is no title. */
export function chartTitle(
  title: string | undefined, width: number, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; top: number } {
  if (!title) return { marks: [], top: CHART_PAD };
  const mark = textMark({
    key: 'title', text: title, x: width / 2, y: CHART_PAD, baseline: 'top', font: theme.font, color: theme.text, measure, bold: true,
    datum: { edit: 'title' },
  });
  return { marks: [mark], top: CHART_PAD + mark.pose.height + GAP };
}

/** `data` with its title set to `text`, trimmed; an empty one drops it. `data` itself when that changes nothing. */
export function withTitle<D extends { title?: string }>(data: D, text: string): D {
  const title = text.trim();
  if ((data.title ?? '') === title) return data;
  const { title: _, ...rest } = data;
  return (title === '' ? rest : { ...rest, title }) as D;
}
