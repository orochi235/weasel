/** A user journey compiled to its sections, scored steps and actor legend. */
import { axisMarks, axisRoom } from '../axes';
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { pointMark, spanMark } from '../marks/boxes';
import { ruleMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { bandScale, type BandScale } from '../scales/band';
import { linearScale, type LinearScale } from '../scales/linear';
import { ordinalScale, type OrdinalScale } from '../scales/ordinal';
import { seriesColor, type PlotTheme } from '../theme';
import type { JourneyData } from './types';

/** Where a journey's parts landed: the plot area, the score scale up it, and each step's band across it. */
export interface JourneyLayout {
  plot: { x: number; y: number; width: number; height: number };
  score: LinearScale;
  /** Over every step in order, keyed by its place among them all from `'0'`. */
  steps: BandScale;
}

const GAP = 6;
const RADIUS = 8;
const DOT = 3;

/** Every step with its section and its place in it, in order. */
export const journeySteps = (data: JourneyData): { section: number; task: number }[] =>
  data.sections.flatMap((s, section) => s.tasks.map((_, task) => ({ section, task })));

/** The actors, each once, in the order they first take part. */
export const journeyActors = (data: JourneyData): string[] =>
  [...new Set(data.sections.flatMap((s) => s.tasks.flatMap((t) => t.actors)))];

/** Lays out the plot area in `size` below `top`: room for section headers above, step names and actors below, the
 *  score axis to the left and a legend `legend` wide to the right. */
export function journeyLayout(
  data: JourneyData, size: { width: number; height: number }, top: number, legend: number, theme: PlotTheme, measure: PlotMeasure,
): JourneyLayout {
  const line = measure('Mg', theme.font).height;
  const probe = linearScale({ domain: [0.5, 5.5], range: [0, 1] });
  const left = PAD + axisRoom({ scale: probe, side: 'left', at: 0, theme, measure });
  const right = size.width - PAD - (legend > 0 ? legend + 2 * GAP : 0);
  const plotTop = top + line + 2 * GAP;
  const bottom = size.height - PAD - line - 3 * GAP - 2 * DOT;
  const plot = { x: left, y: plotTop, width: Math.max(1, right - left), height: Math.max(1, bottom - plotTop) };
  return {
    plot,
    score: linearScale({ domain: [0.5, 5.5], range: [plot.y + plot.height, plot.y] }),
    steps: bandScale({ domain: journeySteps(data).map((_, k) => String(k)), range: [plot.x, plot.x + plot.width] }),
  };
}

function sectionMarks(data: JourneyData, layout: JourneyLayout, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const marks: PlotMark[] = [];
  const height = measure('Mg', theme.font).height + GAP;
  let k = 0;
  data.sections.forEach((section, s) => {
    const first = k;
    k += section.tasks.length;
    if (section.tasks.length === 0) return;
    const x0 = layout.steps.start(String(first));
    const x1 = layout.steps.start(String(k - 1)) + layout.steps.bandwidth;
    const y = layout.plot.y - GAP - height;
    marks.push(spanMark({ key: `section:${s}`, x0, x1, y, height, color: seriesColor(theme, s), opacity: 0.35, datum: { section: s } }));
    if (section.name !== undefined) {
      marks.push(textMark({
        key: `section:label:${s}`, text: section.name, x: (x0 + x1) / 2, y: y + height / 2, font: theme.font, color: theme.text, measure, bold: true,
        datum: { edit: 'section', section: s },
      }));
    }
  });
  return marks;
}

function stepMarks(data: JourneyData, layout: JourneyLayout, actors: OrdinalScale<string>, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const marks: PlotMark[] = [];
  const baseline = layout.plot.y + layout.plot.height;
  const line = measure('Mg', theme.font).height;
  journeySteps(data).forEach(({ section, task }, k) => {
    const step = data.sections[section]!.tasks[task]!;
    const x = layout.steps.position(String(k));
    const y = layout.score.map(Math.min(5, Math.max(1, step.score)));
    const id = `${section}:${task}`;
    const datum = { section, task };
    marks.push(ruleMark({ key: `task:rule:${id}`, from: { x, y: y + RADIUS }, to: { x, y: baseline }, color: theme.axis, datum }));
    marks.push(pointMark({ key: `task:${id}`, x, y, radius: RADIUS, color: seriesColor(theme, section), datum }));
    marks.push(textMark({
      key: `task:label:${id}`, text: step.name, x, y: baseline + GAP, baseline: 'top', font: theme.font, color: theme.text, measure,
      datum: { edit: 'task', section, task },
    }));
    const dotsY = baseline + GAP + line + GAP + DOT;
    const spread = 3 * DOT;
    step.actors.forEach((actor, a) => {
      marks.push(pointMark({
        key: `task:actor:${id}:${a}`, x: x + (a - (step.actors.length - 1) / 2) * spread, y: dotsY, radius: DOT, color: actors.map(actor),
        datum: { section, task, actor },
      }));
    });
  });
  return marks;
}

function legendMarks(names: readonly string[], actors: OrdinalScale<string>, x: number, midY: number, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const row = measure('Mg', theme.font).height + GAP;
  const top = midY - (row * names.length - GAP) / 2;
  return names.flatMap((actor, k) => {
    const y = top + k * row + (row - GAP) / 2;
    return [
      pointMark({ key: `legend:actor:${k}`, x: x + 2 * DOT, y, radius: 2 * DOT, color: actors.map(actor), datum: { actor } }),
      textMark({
        key: `legend:label:${k}`, text: actor, x: x + 4 * DOT + GAP, y, anchor: 'start', font: theme.font, color: theme.text, measure, datum: { actor },
      }),
    ];
  });
}

/** Lays out a journey in a box of `size`: its title, its steps left to right under their sections' headers, each at
 *  its score up a 1-to-5 axis with its name and its actors' dots under it, and a legend of actors at the right. */
export function compileJourney(
  data: JourneyData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: JourneyLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const names = journeyActors(data);
  const actors = ordinalScale({ domain: names, range: theme.series });
  const legend = names.length === 0 ? 0 : 4 * DOT + GAP + Math.max(...names.map((n) => measure(n, theme.font).width));
  const layout = journeyLayout(data, size, top, legend, theme, measure);
  marks.push(...axisMarks({ key: 'axis:score', scale: layout.score, side: 'left', at: layout.plot.x, gridTo: layout.plot.x + layout.plot.width, theme, measure }));
  marks.push(...sectionMarks(data, layout, theme, measure), ...stepMarks(data, layout, actors, theme, measure));
  marks.push(...legendMarks(names, actors, layout.plot.x + layout.plot.width + 2 * GAP, layout.plot.y + layout.plot.height / 2, theme, measure));
  return { marks, layout };
}
