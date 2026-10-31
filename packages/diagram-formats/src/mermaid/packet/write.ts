/** A plot page holding a packet diagram as Mermaid `packet-beta` text. */
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';

/** `s` in double quotes, a quote inside it written as Mermaid's `#quot;`. */
const quoted = (s: string): string => `"${s.replace(/"/g, '#quot;')}"`;

/** Writes `page`'s packet diagram as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidPacket(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'packet') throw new Error(`Mermaid writes this chart as a packet diagram only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  if (data.bitsPerRow !== undefined && data.bitsPerRow !== 32) warnings.add('Mermaid reads bits per row from its configuration only; it was dropped.');
  const lines = ['packet-beta'];
  if (data.title?.trim()) lines.push(`  title ${data.title.trim()}`);
  let after = -1;
  for (const f of data.fields) {
    const whole = Number.isInteger(f.start) && Number.isInteger(f.end);
    if (!whole || f.end < f.start || f.start <= after) {
      warnings.add('Mermaid reads fields in order of their bits, never overlapping; fields that run backward or overlap were dropped.');
      continue;
    }
    if (f.relative && f.start !== after + 1) warnings.add('Mermaid counts a field\'s bits from the end of the one before; fields after a gap were written as ranges.');
    const bits = f.relative && f.start === after + 1 ? `+${f.end - f.start + 1}` : f.start === f.end ? `${f.start}` : `${f.start}-${f.end}`;
    lines.push(`  ${bits}: ${quoted(f.label)}`);
    after = f.end;
  }
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
