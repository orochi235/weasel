/** A plot page holding a gitgraph as Mermaid `gitGraph` text: front matter for its title, then a line per command. */
import type { GitCommand } from '@weasel-js/plot';
import type { ExportResult, PlotPage } from '../../document';
import { titleLines } from '../common/lines';
import { oneLine } from '../common/text';

type Warn = (m: string) => void;

/** `s` in double quotes, which Mermaid strings cannot hold, so a quote inside becomes a single one. */
function quoted(text: string, warn: Warn): string {
  const s = oneLine(text, 'gitGraph', warn);
  if (s.includes('"')) warn('Mermaid strings hold no double quotes; they were written as single quotes.');
  return `"${s.replace(/"/g, "'")}"`;
}

/** A branch name bare where Mermaid reads it back the same, else quoted. */
const branchName = (s: string, warn: Warn): string => (/^[^\s"]+$/.test(s) ? s : quoted(s, warn));

/** ` key: value` for each of `pairs` that has a value, strings quoted. */
const attrs = (pairs: readonly [string, string | number | undefined, boolean][], warn: Warn): string =>
  pairs.flatMap(([key, value, quote]) => (value === undefined ? [] : [` ${key}: ${quote ? quoted(String(value), warn) : value}`])).join('');

/** A branch's order as Mermaid reads one, a whole number from 0: rounded, with a warning, where it is a number that is
 *  not one, and dropped, with a warning, where no whole number from 0 is near it. */
function branchOrder(order: number | undefined, warn: Warn): number | undefined {
  if (order === undefined) return undefined;
  const n = Math.round(order);
  if (!Number.isSafeInteger(n) || n < 0) {
    warn('Mermaid branch orders are whole numbers from 0; others were dropped.');
    return undefined;
  }
  if (n !== order) warn('Mermaid branch orders are whole numbers; others were rounded.');
  return n;
}

function commandLine(cmd: GitCommand, warn: Warn): string {
  switch (cmd.kind) {
    case 'commit':
      return `commit${attrs([['id', cmd.id, true], ['type', cmd.type, false], ['tag', cmd.tag, true], ['msg', cmd.message, true]], warn)}`;
    case 'branch':
      return `branch ${branchName(cmd.name, warn)}${attrs([['order', branchOrder(cmd.order, warn), false]], warn)}`;
    case 'checkout':
      return `checkout ${branchName(cmd.name, warn)}`;
    case 'merge':
      return `merge ${branchName(cmd.branch, warn)}${attrs([['id', cmd.id, true], ['type', cmd.type, false], ['tag', cmd.tag, true]], warn)}`;
    case 'cherry-pick':
      return `cherry-pick${attrs([['id', cmd.id, true], ['tag', cmd.tag, true], ['parent', cmd.parent, true]], warn)}`;
  }
}

/** Front matter naming the chart and, when it is not `main`, its main branch. */
function frontLines(title: string | undefined, mainBranch: string): string[] {
  const named = titleLines(title);
  if (mainBranch === 'main') return named;
  const config = ['config:', '  gitGraph:', `    mainBranchName: ${JSON.stringify(mainBranch)}`];
  return named.length === 0 ? ['---', ...config, '---'] : [...named.slice(0, -1), ...config, '---'];
}

/** Writes `page`'s gitgraph as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidGitGraph(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'gitgraph') throw new Error(`Mermaid writes this chart as a gitGraph only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings: string[] = [];
  const warn: Warn = (m) => {
    if (!warnings.includes(m)) warnings.push(m);
  };
  const header = data.orientation === undefined ? 'gitGraph' : `gitGraph ${data.orientation}:`;
  const lines = [...frontLines(data.title, data.mainBranch ?? 'main'), header, ...data.commands.map((c) => `  ${commandLine(c, warn)}`)];
  return { text: `${lines.join('\n')}\n`, warnings };
}
