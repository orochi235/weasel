/** A plot page holding a pie as Mermaid `pie` text. */
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';

/** `s` in double quotes, a quote inside it written as Mermaid's `#quot;`. */
const quoted = (s: string): string => `"${s.replace(/"/g, '#quot;')}"`;

/** Writes `page`'s pie as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidPie(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'pie') throw new Error(`Mermaid writes this chart as a pie only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  const title = data.title?.trim();
  const lines = [`pie${data.showData ? ' showData' : ''}${title ? ` title ${title}` : ''}`];
  const labels = new Set<string>();
  for (const s of data.slices) {
    if (labels.has(s.label)) warnings.add('Mermaid reads only the first of slices sharing a label.');
    labels.add(s.label);
    const ok = Number.isFinite(s.value) && s.value >= 0;
    if (!ok) warnings.add('Mermaid holds only non-negative values; others were written as 0.');
    lines.push(`  ${quoted(s.label)} : ${ok ? s.value : 0}`);
  }
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
