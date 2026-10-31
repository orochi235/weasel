/** A Mermaid radar as a one-page document holding a plot page. */
import type { RadarData } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf } from '../common/lines';
import { parseRadarBody } from './parse';

/** The page a radar is read onto. */
export const RADAR_PAGE = { width: 640, height: 560 } as const;

/** Reads a Mermaid `radar-beta` (or `radar`) diagram. Throws, naming the line, on text that is not one. */
export function readMermaidRadar(text: string): ImportResult {
  const src = statementsOf(text);
  if (!/^radar(?:-beta)?$/.test(src.header.text)) throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a radar header`);
  const warnings = new Warnings();
  const parsed = parseRadarBody(src.body);
  if (parsed.title !== undefined && src.title !== undefined && parsed.title !== src.title) {
    warnings.add('The front matter title was dropped; the title statement names the chart.');
  }
  const fallback = pageNameOf({ ...src, ...(parsed.title !== undefined ? { title: parsed.title } : {}) }, warnings);
  const title = parsed.title ?? src.title;
  const data: RadarData = { ...parsed.data, ...(title !== undefined && title !== '' ? { title } : {}) };
  const name = title || fallback;
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name ? { name } : {}), ...RADAR_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
