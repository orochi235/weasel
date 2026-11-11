/** A plot page holding a packet diagram as Mermaid `packet-beta` text. */
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { mermaidQuoted, oneLine } from '../common/text';


const range = (start: number, end: number): string => (start === end ? `${start}` : `${start}-${end}`);

/** Writes `page`'s packet diagram as Mermaid, a gap as an unlabeled field, since Mermaid rejects a field that does not
 *  start where the one before ends. Throws on a page holding another kind of chart. */
export function writeMermaidPacket(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'packet') throw new Error(`Mermaid writes this chart as a packet diagram only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  if (data.bitsPerRow !== undefined && data.bitsPerRow !== 32) warnings.add('Mermaid reads bits per row from its configuration only; it was dropped.');
  const lines = ['packet-beta'];
  const title = data.title === undefined ? '' : oneLine(data.title, 'packet', (m) => warnings.add(m)).trim();
  if (title) lines.push(`  title ${title}`);
  let after = -1;
  for (const f of data.fields) {
    const whole = Number.isInteger(f.start) && Number.isInteger(f.end);
    if (!whole || f.end < f.start || f.start <= after) {
      warnings.add('Mermaid reads fields in order of their bits, never overlapping; fields that run backward or overlap were dropped.');
      continue;
    }
    if (f.start > after + 1) lines.push(`  ${range(after + 1, f.start - 1)}: ""`);
    const bits = f.relative ? `+${f.end - f.start + 1}` : range(f.start, f.end);
    lines.push(`  ${bits}: ${mermaidQuoted(f.label)}`);
    after = f.end;
  }
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
