/** A Mermaid class diagram's grammar, read to statements with each one's line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource, type Statement } from '../common/lines';

/** A relation's end: `<|` or `|>` inheritance, `*` composition, `o` aggregation, `<` or `>` an arrow. */
export type ClassHead = 'triangle' | 'diamond' | 'hollow-diamond' | 'arrow';

/** One member row: an attribute, or a method when it has parentheses. */
export interface ClassMember {
  text: string;
  method: boolean;
}

export type ClassStmt =
  | { kind: 'class'; id: string; label?: string; generic?: string; members: ClassMember[]; annotations: string[]; cssClass?: string; line: number }
  | { kind: 'member'; id: string; member: ClassMember; line: number }
  | { kind: 'annotation'; id: string; name: string; line: number }
  | {
    kind: 'relation'; from: string; to: string; start?: ClassHead; end?: ClassHead; dashed: boolean;
    fromCard?: string; toCard?: string; label?: string; line: number;
  }
  | { kind: 'namespace'; id: string; stmts: ClassStmt[]; line: number }
  | { kind: 'note'; for?: string; text: string; line: number }
  | { kind: 'cssClass'; ids: string[]; name: string; line: number }
  | { kind: 'direction'; value: string; line: number }
  | { kind: 'style'; text: string; line: number }
  | { kind: 'other'; keyword: string; line: number };

/** A whole class diagram. */
export interface ClassDiagram {
  source: MermaidSource;
  stmts: ClassStmt[];
}

const ID = String.raw`([\w-]+)(?:~[^~\s]*~)?`;
const CLASS = /^class\s+([\w-]+)(?:~([^~]*)~)?(?:\s*\[\s*"([^"]*)"\s*\])?(?::::([\w-]+))?\s*(\{.*)?$/;
const RELATION = new RegExp(
  `^${ID}(?:\\s+"([^"]*)")?\\s*(<\\||\\*|o|<)?(--|\\.\\.)(\\|>|\\*|o|>)?\\s*(?:"([^"]*)"\\s*)?${ID}(?:\\s*:\\s*(.*))?$`,
);
const HEADS: Readonly<Record<string, ClassHead>> = { '<|': 'triangle', '|>': 'triangle', '*': 'diamond', o: 'hollow-diamond', '<': 'arrow', '>': 'arrow' };
const MEMBER = /^([\w-]+)\s*:\s*(.+)$/;
const NOTE = /^note\s+(?:for\s+([\w-]+)\s+)?"(.*)"$/;

const memberOf = (text: string): ClassMember => ({ text, method: text.includes('(') });

function relationOf(m: RegExpExecArray, line: number): ClassStmt {
  const [, from, fromCard, start, body, end, toCard, to, label] = m as unknown as (string | undefined)[];
  return {
    kind: 'relation', from: from!, to: to!, dashed: body === '..', line,
    ...(start !== undefined ? { start: HEADS[start]! } : {}),
    ...(end !== undefined ? { end: HEADS[end]! } : {}),
    ...(fromCard !== undefined ? { fromCard } : {}),
    ...(toCard !== undefined ? { toCard } : {}),
    ...(label !== undefined && label.trim() !== '' ? { label: label.trim() } : {}),
  };
}

class ClassParser {
  i = 0;

  constructor(readonly lines: readonly Statement[]) {}

  /** Statements up to the `}` closing a block opened on line `opened`, or to the end when `opened` is null. */
  block(opened: number | null): ClassStmt[] {
    const out: ClassStmt[] = [];
    while (this.i < this.lines.length) {
      const s = this.lines[this.i++]!;
      if (s.text === '}') {
        if (opened === null) throw lineError('Mermaid', s.line, '"}" closes no namespace');
        return out;
      }
      out.push(this.stmt(s));
    }
    if (opened !== null) throw lineError('Mermaid', opened, 'a block opened here is never closed');
    return out;
  }

  stmt({ text, line }: Statement): ClassStmt {
    const cls = CLASS.exec(text);
    if (cls !== null) return this.classDecl(cls, line);
    const ns = /^namespace\s+([\w.-]+)\s*\{$/.exec(text);
    if (ns !== null) return { kind: 'namespace', id: ns[1]!, stmts: this.block(line), line };
    const rel = RELATION.exec(text);
    if (rel !== null) return relationOf(rel, line);
    const ann = /^<<\s*(.+?)\s*>>\s*([\w-]+)$/.exec(text);
    if (ann !== null) return { kind: 'annotation', id: ann[2]!, name: ann[1]!, line };
    const note = NOTE.exec(text);
    if (note !== null) return { kind: 'note', ...(note[1] !== undefined ? { for: note[1] } : {}), text: note[2]!, line };
    const css = /^cssClass\s+"([^"]+)"\s+([\w-]+)$/.exec(text);
    if (css !== null) return { kind: 'cssClass', ids: css[1]!.split(',').map((s) => s.trim()), name: css[2]!, line };
    const dir = /^direction\s+(TB|TD|BT|LR|RL)$/.exec(text);
    if (dir !== null) return { kind: 'direction', value: dir[1]!, line };
    if (/^(classDef|style)\s/.test(text)) return { kind: 'style', text, line };
    const member = MEMBER.exec(text);
    if (member !== null) return { kind: 'member', id: member[1]!, member: memberOf(member[2]!.trim()), line };
    const keyword = /^(click|link|callback)\b/.exec(text);
    if (keyword !== null) return { kind: 'other', keyword: keyword[1]!, line };
    throw lineError('Mermaid', line, `cannot read "${text}" as a class diagram statement`);
  }

  classDecl(m: RegExpExecArray, line: number): ClassStmt {
    const [, id, generic, label, cssClass, open] = m as unknown as (string | undefined)[];
    const members: ClassMember[] = [];
    const annotations: string[] = [];
    const take = (body: string) => {
      const ann = /^<<\s*(.+?)\s*>>$/.exec(body);
      if (ann !== null) annotations.push(ann[1]!);
      else if (body !== '') members.push(memberOf(body));
    };
    if (open !== undefined) {
      const inline = open.slice(1).trim();
      if (inline.endsWith('}')) take(inline.slice(0, -1).trim());
      else {
        if (inline !== '') take(inline);
        for (;;) {
          const s = this.lines[this.i++];
          if (s === undefined) throw lineError('Mermaid', line, `class ${id} is never closed`);
          if (s.text === '}') break;
          take(s.text);
        }
      }
    }
    return {
      kind: 'class', id: id!, members, annotations, line,
      ...(generic !== undefined ? { generic } : {}),
      ...(label !== undefined ? { label } : {}),
      ...(cssClass !== undefined ? { cssClass } : {}),
    };
  }
}

/** Parses a Mermaid class diagram. Throws, naming the line, on text that is not one. */
export function parseClassDiagram(text: string): ClassDiagram {
  const source = statementsOf(text);
  if (!/^classDiagram(-v2)?$/.test(source.header.text)) {
    throw lineError('Mermaid', source.header.line, `expected a classDiagram header, found "${source.header.text}"`);
  }
  return { source, stmts: new ClassParser(source.body).block(null) };
}
