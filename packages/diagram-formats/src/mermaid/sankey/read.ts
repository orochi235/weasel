/** A Mermaid sankey as a one-page document holding a plot page: each CSV row `source,target,value` a link. */
import type { SankeyData, SankeyLink } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf } from '../common/lines';

/** The page a sankey is read onto. */
export const SANKEY_PAGE = { width: 900, height: 540 } as const;

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** One CSV row's fields, RFC 4180 quoting read: `"a, b"` holds its comma, and `""` inside quotes is one quote. */
export function csvFields(row: string, line: number): string[] {
  const out: string[] = [];
  let k = 0;
  for (;;) {
    while (row[k] === ' ' || row[k] === '\t') k++;
    let field = '';
    if (row[k] === '"') {
      for (k++; ; k++) {
        if (k >= row.length) throw lineError('Mermaid', line, 'a quoted field is never closed');
        if (row[k] === '"' && row[k + 1] === '"') field += row[k++];
        else if (row[k] === '"') break;
        else field += row[k];
      }
      k++;
      while (row[k] === ' ' || row[k] === '\t') k++;
      if (k < row.length && row[k] !== ',') throw lineError('Mermaid', line, `"${row.slice(k)}" follows a quoted field`);
    } else {
      const end = row.indexOf(',', k);
      field = row.slice(k, end < 0 ? row.length : end).trim();
      k = end < 0 ? row.length : end;
    }
    out.push(field);
    if (k >= row.length) return out;
    k++;
  }
}

/** Reads a Mermaid `sankey-beta` (or `sankey`) diagram. Throws, naming the line, on text that is not one. */
export function readMermaidSankey(text: string): ImportResult {
  const src = statementsOf(text);
  if (!/^sankey(?:-beta)?$/.test(src.header.text)) throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a sankey header`);
  const links: SankeyLink[] = src.body.map(({ text: row, line }) => {
    const fields = csvFields(row, line);
    if (fields.length !== 3) throw lineError('Mermaid', line, `a row is source,target,value; this one has ${fields.length} field(s)`);
    const [source, target, value] = fields as [string, string, string];
    if (!NUMBER.test(value) || Number(value) < 0) throw lineError('Mermaid', line, `"${value}" is not a flow; it is a number not below zero`);
    return { source, target, value: Number(value) };
  });
  const warnings = new Warnings();
  const name = pageNameOf(src, warnings);
  const data: SankeyData = { kind: 'sankey', ...(src.title !== undefined && src.title !== '' ? { title: src.title } : {}), links };
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name ? { name } : {}), ...SANKEY_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
