/** A Mermaid packet diagram as a one-page document holding a plot page. */
import type { PacketData, PacketField } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf, type Statement } from '../common/lines';
import { unquote } from '../xychart/parse';

/** The page a packet diagram is read onto. */
export const PACKET_PAGE = { width: 800, height: 400 } as const;

const FIELD = /^(?:(\d+)(?:\s*-\s*(\d+))?|\+(\d+))\s*:\s*("[^"]*"|'[^']*')$/;

/** `0-15: "label"`, `16: "label"` or `+8: "label"` as a field after one ending at `after`. Throws, naming the line, on
 *  a line that is not one, or a field that runs backward or overlaps the one before. */
function fieldOf(s: Statement, after: number): PacketField {
  const m = FIELD.exec(s.text);
  if (m === null) throw lineError('Mermaid', s.line, `"${s.text}" is not a packet field`);
  const label = unquote(m[4]!);
  if (m[3] !== undefined) {
    const count = Number(m[3]);
    if (count < 1) throw lineError('Mermaid', s.line, 'a field takes at least one bit');
    return { start: after + 1, end: after + count, label, relative: true };
  }
  const start = Number(m[1]);
  const end = m[2] !== undefined ? Number(m[2]) : start;
  if (end < start) throw lineError('Mermaid', s.line, `a field runs from its first bit to its last, and ${start}-${end} runs backward`);
  if (start <= after) throw lineError('Mermaid', s.line, `the field at ${start} overlaps the one before, which ends at bit ${after}`);
  return { start, end, label };
}

/** Reads a Mermaid `packet-beta` (or `packet`). Throws, naming the line, on text that is not one. */
export function readMermaidPacket(text: string): ImportResult {
  const src = statementsOf(text);
  if (!/^packet(?:-beta)?$/.test(src.header.text)) throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a packet header`);
  const warnings = new Warnings();
  let title: string | undefined;
  const fields: PacketField[] = [];
  for (const s of src.body) {
    const t = /^title(?:\s+(.*))?$/.exec(s.text);
    if (t !== null) title = t[1]?.trim() || undefined;
    else fields.push(fieldOf(s, fields[fields.length - 1]?.end ?? -1));
  }
  const named = pageNameOf(src, warnings);
  if (title !== undefined && src.title !== undefined && src.title !== title) warnings.add('The front matter title was dropped; the chart is titled by its own.');
  title ??= src.title;
  const data: PacketData = { kind: 'packet', ...(title !== undefined ? { title } : {}), fields };
  const name = title ?? named;
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name !== undefined ? { name } : {}), ...PACKET_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
