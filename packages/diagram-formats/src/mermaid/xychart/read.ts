/** A Mermaid xychart as a one-page document holding a plot page. */
import type { XyChartData, XySeries } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { parseXyChart } from './parse';

/** The page an xychart is read onto. */
export const XYCHART_PAGE = { width: 800, height: 500 } as const;

/** Reads a Mermaid `xychart-beta` (or `xychart`) diagram. Throws, naming the line, on text that is not one. */
export function readMermaidXychart(text: string): ImportResult {
  const parsed = parseXyChart(text);
  const warnings: string[] = [];
  const once = new Set<string>();
  const warn = (message: string) => {
    if (!once.has(message)) warnings.push(message);
    once.add(message);
  };
  if (parsed.frontOther > 0) warn('Mermaid front matter other than the title was dropped.');
  let title = parsed.frontTitle;
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
      case 'dropped':
        warn(s.what === 'directive' ? 'Mermaid configuration directives were dropped.' : `The chart's ${s.what} was dropped.`);
        break;
    }
  }
  if (x?.kind === 'band' && x.categories.length > 0) {
    const longest = Math.max(0, ...series.map((s) => s.values.length));
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
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(title ? { name: title } : {}), ...XYCHART_PAGE, data };
  return { document: { pages: [page] }, warnings };
}
