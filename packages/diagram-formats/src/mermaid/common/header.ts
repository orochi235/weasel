/** What every Mermaid diagram starts with: front matter, then a header naming its kind. */

/** A JSON string's value, else the text between its quotes. */
export function jsonString(quoted: string): string {
  try {
    return JSON.parse(quoted) as string;
  } catch {
    return quoted.slice(1, -1);
  }
}

/** A `---` block before the diagram: its `title`, and how many characters and lines it takes. */
export interface FrontMatter {
  title?: string;
  length: number;
  lines: number;
}

/** The front matter at the start of `text`, `length` 0 when there is none. Newlines are `\n`. */
export function frontMatter(text: string): FrontMatter {
  const front = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (front === null) return { length: 0, lines: 0 };
  const t = /^title:[ \t]*(.*)$/m.exec(front[1]!)?.[1]?.trim();
  const title = t === undefined ? undefined : /^".*"$/.test(t) ? jsonString(t) : /^'.*'$/.test(t) ? t.slice(1, -1).replace(/''/g, "'") : t;
  return {
    ...(title !== undefined ? { title } : {}),
    length: front[0].length,
    lines: front[0].split('\n').length - (front[0].endsWith('\n') ? 1 : 0),
  };
}

/** The first statement's line, its first word, and its line number, read before lexing so another diagram kind's syntax is never lexed. */
export function headerWord(text: string): { word: string; text: string; line: number } | null {
  const lines = text.split(/\r\n?|\n/);
  let k = 0;
  if (/^---\s*$/.test(lines[0] ?? '')) {
    k = 1;
    while (k < lines.length && !/^---\s*$/.test(lines[k]!)) k++;
    k++;
  }
  let directive = false;
  for (; k < lines.length; k++) {
    const l = lines[k]!.trim();
    if (directive || l.startsWith('%%{')) {
      directive = !l.includes('}%%');
      continue;
    }
    if (l === '' || l.startsWith('%%')) continue;
    return { word: /^[^\s;]+/.exec(l)![0], text: l, line: k + 1 };
  }
  return null;
}

/** Every Mermaid diagram kind's header word but a flowchart's, whose `graph` a DOT file starts with too, so a file of a
 *  kind not read is still recognized and named. */
export const MERMAID_KINDS = /^(sequenceDiagram|classDiagram(-v2)?|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|C4\w*|mindmap|timeline|zenuml|sankey(-beta)?|xychart(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|radar(-beta)?|treemap(-beta)?)$/;
