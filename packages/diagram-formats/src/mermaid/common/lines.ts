/**
 * A line-oriented Mermaid diagram as its statements: one per line, each with
 * its line number and indent, front matter, `%%` comments, `%%{…}%%`
 * directives, and `accTitle`/`accDescr` read off first. Every kind but the
 * flowchart, whose statements run several to a line, reads its text this way.
 */
import type { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { frontMatter } from './header';

/** One statement, trimmed. */
export interface Statement {
  text: string;
  line: number;
  /** Its leading whitespace's width, a tab counting as four. */
  indent: number;
}

/** A diagram's statements, and what came before and around them. */
export interface MermaidSource {
  /** The header line: the diagram's kind, and anything after it. */
  header: Statement;
  body: Statement[];
  title?: string;
  /** The front matter's lines other than its title. */
  frontConfig?: string;
  accTitle?: string;
  accDescr?: string;
  /** How many `%%{…}%%` directives there were. */
  directives: number;
  /** Each directive's text between `%%{` and `}%%`. */
  directiveTexts: string[];
}

const widthOf = (lead: string): number => [...lead].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);

/** Splits `text` into statements. Throws, naming the line, on an `accDescr { … }` or a `%%{ … }%%` never closed, or a
 *  diagram with no header. */
export function statementsOf(text: string): MermaidSource {
  const source = text.replace(/\r\n?/g, '\n');
  const front = frontMatter(source);
  const raw = source.slice(front.length).split('\n');
  const out: Statement[] = [];
  let directives = 0;
  const directiveTexts: string[] = [];
  let accTitle: string | undefined;
  let accDescr: string | undefined;
  for (let k = 0; k < raw.length; k++) {
    const line = front.lines + k + 1;
    const full = raw[k]!;
    const trimmed = full.trim();
    if (trimmed.startsWith('%%{')) {
      directives++;
      const from = k;
      while (!raw[k]!.includes('}%%') && k < raw.length - 1) k++;
      if (!raw[k]!.includes('}%%')) throw lineError('Mermaid', line, 'a directive opened here is never closed');
      const whole = raw.slice(from, k + 1).join('\n');
      directiveTexts.push(whole.slice(whole.indexOf('%%{') + 3, whole.indexOf('}%%')));
      continue;
    }
    if (trimmed === '' || trimmed.startsWith('%%')) continue;
    const acc = /^acc(Title|Descr)\s*(?::\s*(.*)|\{\s*(.*))$/s.exec(trimmed);
    if (acc !== null && acc[3] === undefined) {
      if (acc[1] === 'Title') accTitle = acc[2]!.trim();
      else accDescr = acc[2]!.trim();
      continue;
    }
    if (acc !== null && acc[3]!.includes('}')) {
      accDescr = acc[3]!.slice(0, acc[3]!.indexOf('}')).trim();
      continue;
    }
    if (acc !== null) {
      const lines = [acc[3]!];
      for (k++; k < raw.length && !raw[k]!.includes('}'); k++) lines.push(raw[k]!.trim());
      if (k >= raw.length) throw lineError('Mermaid', line, 'an accDescr block is never closed');
      lines.push(raw[k]!.slice(0, raw[k]!.indexOf('}')).trim());
      accDescr = lines.filter((l) => l !== '').join('\n');
      continue;
    }
    out.push({ text: trimmed, line, indent: widthOf(/^\s*/.exec(full)![0]) });
  }
  const [header, ...body] = out;
  if (header === undefined) throw lineError('Mermaid', front.lines + 1, 'the diagram has no header');
  return {
    header, body, directives, directiveTexts,
    ...(front.title !== undefined ? { title: front.title } : {}),
    ...(front.config !== undefined ? { frontConfig: front.config } : {}),
    ...(accTitle !== undefined ? { accTitle } : {}),
    ...(accDescr !== undefined ? { accDescr } : {}),
  };
}

/** Whether `text`, written as a line of its own, reads back as a statement rather than as a blank line, a comment, a
 *  directive, or an accessible title or description, which {@link statementsOf} reads off first. */
export function readsAsStatement(text: string): boolean {
  const t = text.trim();
  return t !== '' && !t.startsWith('%%') && !/^acc(?:Title|Descr)\s*[:{]/.test(t);
}

/** The page name `src` gives: the first that is not empty of `own` (a title statement's text), its front matter title,
 *  and its accessible title. Warns of what a page does not hold, a front matter title `own` replaces among it. */
export function readPageName(
  src: Pick<MermaidSource, 'title' | 'frontConfig' | 'accTitle' | 'accDescr' | 'directives'>,
  warnings: Warnings,
  own?: string,
): string | undefined {
  if (src.frontConfig !== undefined) warnings.add('Mermaid front matter other than the title was dropped.');
  if (src.directives > 0) warnings.add('Mermaid configuration directives were dropped.');
  if (src.accDescr !== undefined) warnings.add('Mermaid accessible descriptions were dropped.');
  const title = [own, src.title].find((t) => t !== undefined && t !== '');
  if (own !== undefined && own !== '' && src.title !== undefined && src.title !== '' && own !== src.title) {
    warnings.add('The front matter title was dropped; the title statement names the chart.');
  }
  if (title !== undefined && src.accTitle !== undefined) warnings.add('Mermaid accessible titles were dropped; the page is named by the title.');
  return title ?? src.accTitle;
}

/** Warns where a chart page's name is not its chart's title, which is all a Mermaid chart names it by. */
export function warnDroppedPageName(page: { name?: string; data: { title?: string } }, warn: (message: string) => void): void {
  if (page.name !== undefined && page.name !== '' && page.name !== page.data.title) warn('Mermaid names a chart by its title; a page name the title does not match was dropped.');
}

/** The front matter naming a page, as lines to start a diagram with. */
export const titleLines = (name: string | undefined): string[] => (name === undefined ? [] : ['---', `title: ${JSON.stringify(name)}`, '---']);

/** The directions a Mermaid `direction` statement names. */
export type MermaidDirection = 'TB' | 'TD' | 'BT' | 'LR' | 'RL';
