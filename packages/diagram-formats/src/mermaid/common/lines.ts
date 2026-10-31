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
  accTitle?: string;
  accDescr?: string;
  /** How many `%%{…}%%` directives there were. */
  directives: number;
}

const widthOf = (lead: string): number => [...lead].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);

/** Splits `text` into statements. Throws, naming the line, on an `accDescr { … }` never closed or a diagram with no header. */
export function statementsOf(text: string): MermaidSource {
  const source = text.replace(/\r\n?/g, '\n');
  const front = frontMatter(source);
  const raw = source.slice(front.length).split('\n');
  const out: Statement[] = [];
  let directives = 0;
  let accTitle: string | undefined;
  let accDescr: string | undefined;
  for (let k = 0; k < raw.length; k++) {
    const line = front.lines + k + 1;
    const full = raw[k]!;
    const trimmed = full.trim();
    if (trimmed.startsWith('%%{')) {
      directives++;
      while (!raw[k]!.includes('}%%') && k < raw.length - 1) k++;
      continue;
    }
    if (trimmed === '' || trimmed.startsWith('%%')) continue;
    const acc = /^acc(Title|Descr)\s*(?::\s*(.*)|\{\s*(.*))$/.exec(trimmed);
    if (acc !== null && acc[3] === undefined) {
      if (acc[1] === 'Title') accTitle = acc[2]!.trim();
      else accDescr = acc[2]!.trim();
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
    header, body, directives,
    ...(front.title !== undefined ? { title: front.title } : {}),
    ...(accTitle !== undefined ? { accTitle } : {}),
    ...(accDescr !== undefined ? { accDescr } : {}),
  };
}

/** The page name `src` gives: its title, else its accessible title. Warns of what a page does not hold. */
export function pageNameOf(src: MermaidSource, warnings: Warnings): string | undefined {
  if (src.directives > 0) warnings.add('Mermaid configuration directives were dropped.');
  if (src.accDescr !== undefined) warnings.add('Mermaid accessible descriptions were dropped.');
  if (src.title !== undefined && src.accTitle !== undefined) warnings.add('Mermaid accessible titles were dropped; the page is named by the title.');
  return src.title ?? src.accTitle;
}

/** The front matter naming a page, as lines to start a diagram with. */
export const titleLines = (name: string | undefined): string[] => (name === undefined ? [] : ['---', `title: ${JSON.stringify(name)}`, '---']);
