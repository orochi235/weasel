/** A plot page holding an xychart as Mermaid `xychart-beta` text. */
import type { XyChartData } from '@weasel-js/plot';
import type { ExportResult, PlotPage } from '../../document';

/** `s` quoted, a quote inside it written as Mermaid's `#quot;`. */
const quoted = (s: string): string => `"${s.replace(/"/g, '#quot;')}"`;

/** A category bare where Mermaid reads it back the same, else quoted. */
const category = (s: string): string => (/^[\w.-]+$/.test(s) ? s : quoted(s));

const titled = (title: string | undefined): string => (title !== undefined ? ` ${quoted(title)}` : '');

function xAxisLine(x: NonNullable<XyChartData['x']>): string | null {
  if (x.kind === 'range') return `x-axis${titled(x.title)} ${x.min} --> ${x.max}`;
  if (x.categories.length === 0) return x.title !== undefined ? `x-axis${titled(x.title)}` : null;
  return `x-axis${titled(x.title)} [${x.categories.map(category).join(', ')}]`;
}

function yAxisLine(y: NonNullable<XyChartData['y']>, warn: (m: string) => void): string | null {
  const both = y.min !== undefined && y.max !== undefined;
  if (!both && (y.min !== undefined || y.max !== undefined)) warn('Mermaid holds both ends of the y axis or neither; its one end was dropped.');
  if (!both && y.title === undefined) return null;
  return `y-axis${titled(y.title)}${both ? ` ${y.min} --> ${y.max}` : ''}`;
}

/** Writes `page`'s xychart as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidXychart(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'xychart') throw new Error(`Mermaid writes this chart as an xychart only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings: string[] = [];
  const warn = (m: string) => {
    if (!warnings.includes(m)) warnings.push(m);
  };
  const lines = [data.orientation === 'horizontal' ? 'xychart-beta horizontal' : 'xychart-beta'];
  if (data.title !== undefined) lines.push(`  title ${quoted(data.title)}`);
  const x = data.x && xAxisLine(data.x);
  if (x) lines.push(`  ${x}`);
  const y = data.y && yAxisLine(data.y, warn);
  if (y) lines.push(`  ${y}`);
  for (const s of data.series) {
    if (s.values.some((v) => !Number.isFinite(v))) warn('Mermaid holds no missing values; they were written as 0.');
    lines.push(`  ${s.kind}${titled(s.name)} [${s.values.map((v) => (Number.isFinite(v) ? v : 0)).join(', ')}]`);
  }
  return { text: `${lines.join('\n')}\n`, warnings };
}
