/** A Mermaid architecture diagram's grammar, read to statements with each one's line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource } from '../common/lines';
import { unquote } from '../common/text';

/** A side of a service, as an edge names it. */
export type ArchSide = 'L' | 'R' | 'T' | 'B';

/** One end of an edge: a service or junction, the side it leaves by, and whether it meets the group around it. */
export interface ArchEnd {
  id: string;
  side: ArchSide;
  group: boolean;
}

export type ArchStmt =
  | { kind: 'group'; id: string; icon?: string; title?: string; in?: string; line: number }
  | { kind: 'service'; id: string; icon?: string; title?: string; in?: string; line: number }
  | { kind: 'junction'; id: string; in?: string; line: number }
  | { kind: 'edge'; from: ArchEnd; to: ArchEnd; start: boolean; end: boolean; line: number };

/** A whole architecture diagram. */
export interface ArchDiagram {
  source: MermaidSource;
  stmts: ArchStmt[];
}

const ID = String.raw`[\p{L}\p{N}_][\p{L}\p{N}_-]*`;
const BOX = new RegExp(`^(group|service)\\s+(${ID})(?:\\(([^)]*)\\))?(?:\\[([^\\]]*)\\])?(?:\\s+in\\s+(${ID}))?$`, 'u');
const JUNCTION = new RegExp(`^junction\\s+(${ID})(?:\\s+in\\s+(${ID}))?$`, 'u');
const EDGE = new RegExp(`^(${ID})(\\{group\\})?\\s*:\\s*([LRTB])\\s*(<)?--(>)?\\s*([LRTB])\\s*:\\s*(${ID})(\\{group\\})?$`, 'u');

/** Parses a Mermaid architecture diagram. Throws, naming the line, on text that is not one. */
export function parseArchitecture(text: string): ArchDiagram {
  const source = statementsOf(text);
  if (!/^architecture(-beta)?$/.test(source.header.text)) {
    throw lineError('Mermaid', source.header.line, `expected an architecture-beta header, found "${source.header.text}"`);
  }
  const stmts = source.body.map(({ text: t, line }): ArchStmt => {
    const box = BOX.exec(t);
    if (box !== null) {
      const [, kind, id, icon, title, parent] = box as unknown as [string, 'group' | 'service', string, string?, string?, string?];
      return {
        kind, id: id, line,
        ...(icon !== undefined && icon.trim() !== '' ? { icon: icon.trim() } : {}),
        ...(title !== undefined ? { title: unquote(title.trim()) } : {}),
        ...(parent !== undefined ? { in: parent } : {}),
      };
    }
    const junction = JUNCTION.exec(t);
    if (junction !== null) return { kind: 'junction', id: junction[1]!, line, ...(junction[2] !== undefined ? { in: junction[2] } : {}) };
    const edge = EDGE.exec(t);
    if (edge !== null) {
      const [, from, fromGroup, fromSide, start, end, toSide, to, toGroup] = edge as unknown as (string | undefined)[];
      return {
        kind: 'edge', line, start: start !== undefined, end: end !== undefined,
        from: { id: from!, side: fromSide as ArchSide, group: fromGroup !== undefined },
        to: { id: to!, side: toSide as ArchSide, group: toGroup !== undefined },
      };
    }
    throw lineError('Mermaid', line, `cannot read "${t}" as an architecture statement`);
  });
  return { source, stmts };
}
