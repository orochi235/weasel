/** A Mermaid quadrant chart as a one-page document holding a plot page. */
import type { QuadrantAxis, QuadrantData, QuadrantPoint, QuadrantPointStyle } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf } from '../common/lines';
import { axisOf, pointOf, styleOf, textOf } from './parse';

/** The page a quadrant chart is read onto. */
export const QUADRANT_PAGE = { width: 600, height: 600 } as const;

/** Reads a Mermaid `quadrantChart`. Throws, naming the line, on text that is not one or a point outside the unit square. */
export function readMermaidQuadrant(text: string): ImportResult {
  const src = statementsOf(text);
  if (src.header.text !== 'quadrantChart') throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a quadrantChart header`);
  const warnings = new Warnings();
  let title: string | undefined;
  const axes: { x?: QuadrantAxis; y?: QuadrantAxis } = {};
  const quadrants: [string?, string?, string?, string?] = [undefined, undefined, undefined, undefined];
  const points: QuadrantPoint[] = [];
  const classes: Record<string, QuadrantPointStyle> = {};
  for (const s of src.body) {
    const m = /^(\S+)(?:\s+(.*))?$/.exec(s.text)!;
    const keyword = m[1]!;
    const rest = m[2] ?? '';
    const quadrant = /^quadrant-([1-4])$/.exec(keyword);
    if (keyword === 'title') title = rest.trim() || undefined;
    else if (keyword === 'x-axis' || keyword === 'y-axis') axes[keyword[0] as 'x' | 'y'] = axisOf(rest);
    else if (quadrant !== null) quadrants[(Number(quadrant[1]) - 1) as 0 | 1 | 2 | 3] = textOf(rest) || undefined;
    else if (keyword === 'classDef') {
      const c = /^([\w-]+)\s*(.*)$/.exec(rest);
      if (c === null) throw lineError('Mermaid', s.line, 'a classDef needs a name');
      classes[c[1]!] = styleOf(c[2]!, s.line);
    } else {
      const point = pointOf(s);
      if (point === null) throw lineError('Mermaid', s.line, `"${s.text}" is not a quadrantChart statement`);
      points.push(point);
    }
  }
  const named = pageNameOf(src, warnings);
  if (title !== undefined && src.title !== undefined && src.title !== title) warnings.add('The front matter title was dropped; the chart is titled by its own.');
  title ??= src.title;
  while (quadrants.length > 0 && quadrants[quadrants.length - 1] === undefined) quadrants.pop();
  const axis = (a: QuadrantAxis | undefined) => (a !== undefined && Object.keys(a).length > 0 ? a : undefined);
  const x = axis(axes.x);
  const y = axis(axes.y);
  const data: QuadrantData = {
    kind: 'quadrant',
    ...(title !== undefined ? { title } : {}),
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    ...(quadrants.length > 0 ? { quadrants } : {}),
    points,
    ...(Object.keys(classes).length > 0 ? { classes } : {}),
  };
  const name = title ?? named;
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name !== undefined ? { name } : {}), ...QUADRANT_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
