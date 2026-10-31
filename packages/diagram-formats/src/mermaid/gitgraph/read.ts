/** A Mermaid gitGraph as a one-page document holding a plot page. */
import { replayGitGraph, type GitGraphData } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf } from '../common/lines';
import { commandOf } from './parse';

/** The page a gitGraph is read onto. */
export const GITGRAPH_PAGE = { width: 900, height: 420 } as const;

const HEADER = /^gitGraph(?:\s+(LR|TB|BT))?\s*:?$/;

/** Reads a Mermaid `gitGraph` diagram. Throws, naming the line, on text that is not one, or a command Mermaid
 *  would refuse: checking out a branch never made, making one twice, a merge or cherry-pick with nothing to take. */
export function readMermaidGitGraph(text: string): ImportResult {
  const src = statementsOf(text);
  const header = HEADER.exec(src.header.text);
  if (header === null) throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a gitGraph header`);
  const commands = src.body.map(commandOf);
  const data: GitGraphData = {
    kind: 'gitgraph',
    ...(src.title !== undefined && src.title !== '' ? { title: src.title } : {}),
    ...(header[1] !== undefined ? { orientation: header[1] as 'LR' | 'TB' | 'BT' } : {}),
    commands,
  };
  const { error } = replayGitGraph(data);
  if (error !== undefined) throw lineError('Mermaid', src.body[error.command]!.line, error.message);
  const warnings = new Warnings();
  if (commands.some((c) => c.kind === 'commit' && c.message !== undefined)) warnings.add('Commit messages are kept but not drawn.');
  const name = pageNameOf(src, warnings);
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name ? { name } : {}), ...GITGRAPH_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
