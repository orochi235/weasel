/** A plot page holding a radar as Mermaid `radar-beta` text. */
import type { ExportResult, PlotPage } from '../../document';

const ID = /^[A-Za-z_][\w-]*$/;

/** An axis or curve as Mermaid names it: its id, and its label in brackets where it has one. */
function item(x: { id: string; label?: string }, warn: (m: string) => void): string {
  let id = x.id;
  if (!ID.test(id)) {
    warn('Mermaid ids are a letter or underscore, then letters, digits, "-" or "_"; others were rewritten.');
    id = /^[A-Za-z_]/.test(id) ? id.replace(/[^\w-]/g, '_') : `_${id.replace(/[^\w-]/g, '_')}`;
  }
  if (x.label === undefined) return id;
  if (x.label.includes('"')) warn('Mermaid labels hold no double quotes; they were written as single quotes.');
  return `${id}["${x.label.replace(/"/g, "'")}"]`;
}

const option = (key: string, value: number | string | boolean | undefined): string[] => (value === undefined ? [] : [`  ${key} ${value}`]);

/** Writes `page`'s radar as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidRadar(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'radar') throw new Error(`Mermaid writes this chart as a radar only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings: string[] = [];
  const warn = (m: string) => {
    if (!warnings.includes(m)) warnings.push(m);
  };
  const lines = ['radar-beta'];
  if (data.title !== undefined) lines.push(`  title ${data.title}`);
  if (data.axes.length > 0) lines.push(`  axis ${data.axes.map((a) => item(a, warn)).join(', ')}`);
  for (const c of data.curves) {
    const values = data.axes.map((_, i) => c.values[i]);
    if (values.some((v) => v === undefined || !Number.isFinite(v))) warn('Mermaid holds a value on every axis; missing ones were written as 0.');
    if (c.values.length > data.axes.length) warn('Values past the last axis were dropped.');
    lines.push(`  curve ${item(c, warn)}{${values.map((v) => (v !== undefined && Number.isFinite(v) ? v : 0)).join(', ')}}`);
  }
  lines.push(
    ...option('max', data.max), ...option('min', data.min), ...option('graticule', data.graticule),
    ...option('ticks', data.ticks), ...option('showLegend', data.showLegend),
  );
  return { text: `${lines.join('\n')}\n`, warnings };
}
