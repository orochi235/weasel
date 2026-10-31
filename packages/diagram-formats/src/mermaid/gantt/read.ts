/** A Mermaid gantt as a one-page document holding a plot page. */
import type { GanttData, GanttTask } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf } from '../common/lines';
import { ganttText, parseGanttTask } from './parse';

/** The page a gantt is read onto. */
export const GANTT_PAGE = { width: 1000, height: 500 } as const;

/** Statements read and dropped: what a chart does not hold. */
const DROPPED = new Set(['click', 'call', 'inclusiveEndDates', 'topAxis', 'tickInterval', 'weekday', 'displayMode', 'weekend', 'vert', 'includes']);

/** Reads a Mermaid `gantt`. Throws, naming the line, on text that is not one. */
export function readMermaidGantt(text: string): ImportResult {
  const src = statementsOf(text);
  const warnings = new Warnings();
  if (src.header.text !== 'gantt') throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a gantt header`);
  const settings: { title?: string; dateFormat?: string; axisFormat?: string; excludes?: string[]; todayMarker?: string } = {};
  const sections: { name?: string; tasks: GanttTask[] }[] = [{ tasks: [] }];
  for (const s of src.body) {
    const m = /^(\S+)(?:\s+(.*))?$/.exec(s.text)!;
    const [keyword, rest = ''] = [m[1]!, m[2]?.trim()];
    // A colon makes the line a task named for the word, except after `click` and `call`, whose links hold colons.
    if (DROPPED.has(keyword) && (keyword === 'click' || keyword === 'call' || !s.text.includes(':'))) {
      warnings.list('Mermaid gantt statements were dropped', keyword);
      continue;
    }
    switch (keyword) {
      case 'title': settings.title = ganttText(rest); continue;
      case 'dateFormat': settings.dateFormat = rest; continue;
      case 'axisFormat': settings.axisFormat = rest; continue;
      case 'excludes': settings.excludes = rest.split(/[\s,]+/).filter((e) => e !== ''); continue;
      case 'todayMarker': settings.todayMarker = rest; continue;
      case 'section': sections.push({ name: ganttText(rest), tasks: [] }); continue;
    }
    const task = parseGanttTask(s.text, s.line);
    if (task === 'vert') warnings.add('Mermaid gantt vertical markers were dropped.');
    else sections[sections.length - 1]!.tasks.push(task);
  }
  const name = pageNameOf(src, warnings);
  const { title, ...rest } = settings;
  if (title !== undefined && src.title !== undefined && title !== src.title) {
    warnings.add('The front matter title was dropped; the chart is named by its title statement.');
  }
  const chartTitle = title || src.title;
  const data: GanttData = {
    kind: 'gantt',
    ...(chartTitle ? { title: chartTitle } : {}),
    ...rest,
    sections: sections.filter((sec, i) => i > 0 || sec.tasks.length > 0),
  };
  const pageName = chartTitle || name;
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(pageName ? { name: pageName } : {}), ...GANTT_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
