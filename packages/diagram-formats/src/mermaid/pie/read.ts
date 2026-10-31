/** A Mermaid pie as a one-page document holding a plot page. */
import type { PieData, PieSlice } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf } from '../common/lines';
import { unquote } from '../xychart/parse';

/** The page a pie is read onto. */
export const PIE_PAGE = { width: 640, height: 400 } as const;

const HEADER = /^pie(\s+showData)?(?:\s+title(?:\s+(.*))?)?$/;
const SLICE = /^("[^"]*"|'[^']*')\s*:\s*(\S+)$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** Reads a Mermaid `pie`. Throws, naming the line, on text that is not one or a value that is not a non-negative number. */
export function readMermaidPie(text: string): ImportResult {
  const src = statementsOf(text);
  const head = HEADER.exec(src.header.text);
  if (head === null) throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a pie header`);
  const warnings = new Warnings();
  let title = head[2]?.trim() || undefined;
  const slices: PieSlice[] = [];
  const labels = new Set<string>();
  for (const s of src.body) {
    const t = /^title(?:\s+(.*))?$/.exec(s.text);
    if (t !== null) {
      title = t[1]?.trim() || undefined;
      continue;
    }
    const m = SLICE.exec(s.text);
    if (m === null) throw lineError('Mermaid', s.line, `"${s.text}" is not a pie slice`);
    if (!NUMBER.test(m[2]!)) throw lineError('Mermaid', s.line, `"${m[2]}" is not a number`);
    const value = Number(m[2]);
    if (value < 0) throw lineError('Mermaid', s.line, `a slice's value must not be negative, and ${m[2]} is`);
    const label = unquote(m[1]!);
    if (labels.has(label)) {
      warnings.list('Mermaid keeps the first of slices sharing a label; the others were dropped', label);
      continue;
    }
    labels.add(label);
    slices.push({ label, value });
  }
  const named = pageNameOf(src, warnings);
  if (title !== undefined && src.title !== undefined && src.title !== title) warnings.add('The front matter title was dropped; the chart is titled by its own.');
  title ??= src.title;
  const data: PieData = { kind: 'pie', ...(title !== undefined ? { title } : {}), ...(head[1] !== undefined ? { showData: true } : {}), slices };
  const name = title ?? named;
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name !== undefined ? { name } : {}), ...PIE_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
