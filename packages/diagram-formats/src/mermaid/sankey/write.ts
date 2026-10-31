/** A plot page holding a sankey as Mermaid `sankey-beta` text: front matter for its title, then a CSV row per link. */
import type { ExportResult, PlotPage } from '../../document';
import { titleLines } from '../common/lines';

/** A field bare where it reads back the same, else quoted, a quote inside doubled. A row starting `%%` or `acc` would
 *  read as a comment or accessibility text. */
const field = (s: string): string => (/[",\n]/.test(s) || s !== s.trim() || /^(?:%%|acc)/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Writes `page`'s sankey as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidSankey(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'sankey') throw new Error(`Mermaid writes this chart as a sankey only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings: string[] = [];
  const rows = data.links.map((l) => {
    const ok = Number.isFinite(l.value) && l.value >= 0;
    if (!ok && warnings.length === 0) warnings.push('Mermaid holds flows of zero or more; others were written as 0.');
    return `${field(l.source)},${field(l.target)},${ok ? l.value : 0}`;
  });
  return { text: `${[...titleLines(data.title), 'sankey-beta', '', ...rows].join('\n')}\n`, warnings };
}
