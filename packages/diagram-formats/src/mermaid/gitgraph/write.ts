/** A plot page holding a gitgraph as Mermaid `gitGraph` text: front matter for its title, then a line per command. */
import type { GitCommand } from '@weasel-js/plot';
import type { ExportResult, PlotPage } from '../../document';
import { titleLines } from '../common/lines';

type Warn = (m: string) => void;

/** `s` in double quotes, which Mermaid strings cannot hold, so a quote inside becomes a single one. */
function quoted(s: string, warn: Warn): string {
  if (s.includes('"')) warn('Mermaid strings hold no double quotes; they were written as single quotes.');
  return `"${s.replace(/"/g, "'")}"`;
}

/** A branch name bare where Mermaid reads it back the same, else quoted. */
const branchName = (s: string, warn: Warn): string => (/^[^\s"]+$/.test(s) ? s : quoted(s, warn));

/** ` key: value` for each of `pairs` that has a value, strings quoted. */
const attrs = (pairs: readonly [string, string | number | undefined, boolean][], warn: Warn): string =>
  pairs.flatMap(([key, value, quote]) => (value === undefined ? [] : [` ${key}: ${quote ? quoted(String(value), warn) : value}`])).join('');

function commandLine(cmd: GitCommand, main: (name: string) => string, warn: Warn): string {
  switch (cmd.kind) {
    case 'commit':
      return `commit${attrs([['id', cmd.id, true], ['type', cmd.type, false], ['tag', cmd.tag, true], ['msg', cmd.message, true]], warn)}`;
    case 'branch':
      return `branch ${branchName(main(cmd.name), warn)}${attrs([['order', cmd.order, false]], warn)}`;
    case 'checkout':
      return `checkout ${branchName(main(cmd.name), warn)}`;
    case 'merge':
      return `merge ${branchName(main(cmd.branch), warn)}${attrs([['id', cmd.id, true], ['type', cmd.type, false], ['tag', cmd.tag, true]], warn)}`;
    case 'cherry-pick':
      return `cherry-pick${attrs([['id', cmd.id, true], ['tag', cmd.tag, true], ['parent', cmd.parent, true]], warn)}`;
  }
}

/** Writes `page`'s gitgraph as Mermaid. Throws on a page holding another kind of chart, or one whose main branch is
 *  not `main` while another branch is. */
export function writeMermaidGitGraph(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'gitgraph') throw new Error(`Mermaid writes this chart as a gitGraph only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings: string[] = [];
  const warn: Warn = (m) => {
    if (!warnings.includes(m)) warnings.push(m);
  };
  const mainBranch = data.mainBranch ?? 'main';
  if (mainBranch !== 'main') {
    if (data.commands.some((c) => c.kind === 'branch' && c.name === 'main')) {
      throw new Error(`Mermaid's main branch is "main", and this graph has another branch by that name besides its main branch "${mainBranch}"`);
    }
    warn(`Mermaid's main branch is "main"; "${mainBranch}" was written as main.`);
  }
  const main = (name: string) => (name === mainBranch ? 'main' : name);
  const header = data.orientation === undefined ? 'gitGraph' : `gitGraph ${data.orientation}:`;
  const lines = [...titleLines(data.title), header, ...data.commands.map((c) => `  ${commandLine(c, main, warn)}`)];
  return { text: `${lines.join('\n')}\n`, warnings };
}
