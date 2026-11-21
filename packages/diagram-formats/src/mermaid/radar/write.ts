/** A plot page holding a radar as Mermaid `radar-beta` text. */
import type { ExportResult, PlotPage } from '../../document';
import { mermaidIds, oneLine } from '../common/text';

const ID = /^[A-Za-z_][\w-]*$/;

/** Each axis or curve as Mermaid names it: its id, distinct from the others, and its label in brackets where it has one. */
function items(xs: readonly { id: string; label?: string }[], warn: (m: string) => void): string[] {
  const ids = mermaidIds(xs.map((x) => x.id), { id: ID, keywords: [] });
  return xs.map((x) => {
    const id = ids.get(x.id)!;
    if (id !== x.id) warn('Mermaid ids are a letter or underscore, then letters, digits, "-" or "_"; others were rewritten.');
    if (x.label === undefined) return id;
    const label = oneLine(x.label, 'radar', warn);
    if (label.includes('"')) warn('Mermaid labels hold no double quotes; they were written as single quotes.');
    return `${id}["${label.replace(/"/g, "'")}"]`;
  });
}

const option = (key: string, value: string | boolean | undefined): string[] => (value === undefined ? [] : [`  ${key} ${value}`]);

/** A number option's line, none for one unset, or, with a warning, for one that is not a finite number. */
function numberOption(key: string, value: number | undefined, warn: (m: string) => void): string[] {
  if (value === undefined) return [];
  if (Number.isFinite(value)) return [`  ${key} ${value}`];
  warn('Mermaid radar max, min and ticks are numbers; ones that were not were dropped.');
  return [];
}

/** Writes `page`'s radar as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidRadar(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'radar') throw new Error(`Mermaid writes this chart as a radar only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings: string[] = [];
  const warn = (m: string) => {
    if (!warnings.includes(m)) warnings.push(m);
  };
  const lines = ['radar-beta'];
  if (data.title !== undefined) lines.push(`  title ${oneLine(data.title, 'radar', warn)}`);
  if (data.axes.length > 0) lines.push(`  axis ${items(data.axes, warn).join(', ')}`);
  const curves = items(data.curves, warn);
  for (const [i, c] of data.curves.entries()) {
    const values = data.axes.map((_, i) => c.values[i]);
    if (values.some((v) => v === undefined || !Number.isFinite(v))) warn('Mermaid holds a value on every axis; missing ones were written as 0.');
    if (c.values.length > data.axes.length) warn('Values past the last axis were dropped.');
    lines.push(`  curve ${curves[i]}{${values.map((v) => (v !== undefined && Number.isFinite(v) ? v : 0)).join(', ')}}`);
  }
  lines.push(
    ...numberOption('max', data.max, warn), ...numberOption('min', data.min, warn), ...option('graticule', data.graticule),
    ...numberOption('ticks', data.ticks, warn), ...option('showLegend', data.showLegend),
  );
  return { text: `${lines.join('\n')}\n`, warnings };
}
