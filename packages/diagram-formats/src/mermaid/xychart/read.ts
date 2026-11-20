/** A Mermaid xychart as a one-page document holding a plot page. */
import type { XyChartData, XySeries } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { readPageName } from '../common/lines';
import { parseXyChart } from './parse';

/** The page an xychart is read onto. */
export const XYCHART_PAGE = { width: 800, height: 500 } as const;

/** Reads a Mermaid `xychart-beta` (or `xychart`) diagram. Throws, naming the line, on text that is not one. */
export function readMermaidXychart(text: string): ImportResult {
  const parsed = parseXyChart(text);
  const warnings = new Warnings();
  const warn = (message: string) => warnings.add(message);
  if (parsed.frontOther > 0) warn('Mermaid front matter other than the title was dropped.');
  let title = parsed.source.title;
  let x: XyChartData['x'];
  let y: XyChartData['y'];
  const series: XySeries[] = [];
  for (const s of parsed.statements) {
    switch (s.kind) {
      case 'title': title = s.text; break;
      case 'x-axis':
        x = s.range !== undefined
          ? { kind: 'range', ...(s.title !== undefined ? { title: s.title } : {}), min: s.range[0], max: s.range[1] }
          : { kind: 'band', ...(s.title !== undefined ? { title: s.title } : {}), categories: s.categories ?? [] };
        break;
      case 'y-axis':
        y = { ...(s.title !== undefined ? { title: s.title } : {}), ...(s.range !== undefined ? { min: s.range[0], max: s.range[1] } : {}) };
        break;
      case 'bar':
      case 'line':
        series.push({ kind: s.kind, ...(s.name !== undefined ? { name: s.name } : {}), values: s.values });
        break;
    }
  }
  const named = readPageName(parsed.source, warnings, title);
  if (x?.kind === 'band' && x.categories.length > 0) {
    const longest = series.reduce((m, s) => Math.max(m, s.values.length), 0);
    if (longest > x.categories.length) warn(`${longest - x.categories.length} value(s) past the last category are not drawn.`);
  }
  const data: XyChartData = {
    kind: 'xychart',
    ...(title !== undefined && title !== '' ? { title } : {}),
    ...(parsed.orientation === 'horizontal' ? { orientation: 'horizontal' } : {}),
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    series,
  };
  const name = title || named;
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name ? { name } : {}), ...XYCHART_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
