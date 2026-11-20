/** A Mermaid gitGraph as a one-page document holding a plot page. */
import { replayGitGraph, type GitGraphData } from '@weasel-js/plot';
import { getOwn } from '@weasel-js/registry';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { frontTitle } from '../common/header';
import { readPageName, statementsOf, type MermaidSource } from '../common/lines';
import { commandOf } from './parse';

/** The page a gitGraph is read onto. */
export const GITGRAPH_PAGE = { width: 900, height: 420 } as const;

const HEADER = /^gitGraph(?:\s+(LR|TB|BT))?\s*:?$/;

const BRANCH_NAME = /['"]?mainBranchName['"]?\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s,}]+))/;

/** A directive's settings as JSON, Mermaid's single quotes read as double ones, or null when it does not parse. */
function directiveJson(text: string): unknown {
  try {
    return JSON.parse(`{${text.replace(/^\s*(init|initialize)\s*:/, '"$1":').replace(/'/g, '"')}}`);
  } catch {
    return null;
  }
}

/** Whether `json` sets nothing but the gitGraph's main branch name. */
function onlyMainBranch(json: unknown): boolean {
  const only = (o: unknown, key: string): unknown =>
    typeof o === 'object' && o !== null && Object.keys(o).length === 1 ? getOwn(o as Record<string, unknown>, key) : undefined;
  const init = only(json, 'init') ?? only(json, 'initialize');
  return typeof only(only(init, 'gitGraph'), 'mainBranchName') === 'string';
}

/** The main branch's name a `mainBranchName` setting gives, a directive's over the front matter's, and `src` less the
 *  settings that set nothing else, so that only what is dropped is warned of. */
function mainBranchOf(src: MermaidSource): { name?: string; rest: MermaidSource } {
  let name: string | undefined;
  let { frontConfig, directives } = src;
  if (frontConfig !== undefined) {
    const t = /^\s*mainBranchName:[ \t]*(.*)$/m.exec(frontConfig)?.[1];
    if (t !== undefined) name = frontTitle(t);
    if (frontConfig.split('\n').every((l) => /^\s*(?:config|gitGraph):\s*$|^\s*mainBranchName:/.test(l))) frontConfig = undefined;
  }
  for (const text of src.directiveTexts) {
    const m = BRANCH_NAME.exec(text);
    if (m === null) continue;
    name = m[1] ?? m[2] ?? m[3]!;
    if (onlyMainBranch(directiveJson(text))) directives--;
  }
  const { frontConfig: _f, ...base } = src;
  return { ...(name !== undefined ? { name } : {}), rest: { ...base, ...(frontConfig !== undefined ? { frontConfig } : {}), directives } };
}

/** Reads a Mermaid `gitGraph` diagram, its main branch named by a `mainBranchName` setting. Throws, naming the line, on text that is not one, or a command Mermaid
 *  would refuse: checking out a branch never made, making one twice, a merge or cherry-pick with nothing to take. */
export function readMermaidGitGraph(text: string): ImportResult {
  const src = statementsOf(text);
  const header = HEADER.exec(src.header.text);
  if (header === null) throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a gitGraph header`);
  const commands = src.body.map(commandOf);
  const main = mainBranchOf(src);
  const data: GitGraphData = {
    kind: 'gitgraph',
    ...(main.name !== undefined && main.name !== 'main' ? { mainBranch: main.name } : {}),
    ...(src.title !== undefined && src.title !== '' ? { title: src.title } : {}),
    ...(header[1] !== undefined ? { orientation: header[1] as 'LR' | 'TB' | 'BT' } : {}),
    commands,
  };
  const { error } = replayGitGraph(data);
  if (error !== undefined) throw lineError('Mermaid', src.body[error.command]!.line, error.message);
  const warnings = new Warnings();
  if (commands.some((c) => c.kind === 'commit' && c.message !== undefined)) warnings.add('Commit messages are kept but not drawn.');
  const name = readPageName(main.rest, warnings);
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name ? { name } : {}), ...GITGRAPH_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}
