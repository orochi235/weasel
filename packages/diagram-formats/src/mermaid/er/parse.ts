/** A Mermaid entity-relationship diagram's grammar, read to statements with each one's line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource, type Statement } from '../common/lines';
import { unquote } from '../common/text';

/** How many of an entity a relationship's end allows. */
export type ErCardinality = 'zero-one' | 'one' | 'zero-many' | 'one-many';

/** An entity's attribute: its type, name, keys, and comment. */
export interface ErAttribute {
  type: string;
  name: string;
  keys: string[];
  comment?: string;
}

export type ErStmt =
  | { kind: 'entity'; id: string; label?: string; attributes: ErAttribute[]; cssClass?: string; line: number }
  | { kind: 'relation'; from: string; to: string; fromCard: ErCardinality; toCard: ErCardinality; dashed: boolean; label: string; line: number }
  | { kind: 'direction'; value: string; line: number }
  | { kind: 'style'; text: string; line: number };

/** A whole ER diagram. */
export interface ErDiagram {
  source: MermaidSource;
  stmts: ErStmt[];
}

const LEFT: Readonly<Record<string, ErCardinality>> = { '|o': 'zero-one', '||': 'one', '}o': 'zero-many', '}|': 'one-many' };
const RIGHT: Readonly<Record<string, ErCardinality>> = { 'o|': 'zero-one', '||': 'one', 'o{': 'zero-many', '|{': 'one-many' };
const RELATION = /^([\w-]+)\s*(\|o|\|\||\}o|\}\|)(--|\.\.)(o\||\|\||o\{|\|\{)\s*([\w-]+)\s*:\s*(.*)$/;
const ENTITY = /^([\w-]+)(?:\s*\[\s*(?:"([^"]*)"|([^\]]*))\s*\])?(?::::([\w-]+))?\s*(\{\s*\}?)?$/;
const ATTRIBUTE = /^(\S+)\s+(\S+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?$/;

function attributeOf({ text, line }: Statement): ErAttribute {
  const m = ATTRIBUTE.exec(text);
  if (m === null) throw lineError('Mermaid', line, `cannot read "${text}" as an attribute: a type, a name, keys, and a quoted comment`);
  return {
    type: m[1]!, name: m[2]!, keys: m[3] === undefined ? [] : m[3].split(',').map((k) => k.trim()),
    ...(m[4] !== undefined ? { comment: m[4] } : {}),
  };
}

function entityOf(m: RegExpExecArray, lines: readonly Statement[], at: { i: number }, line: number): ErStmt {
  const [, id, quoted, plain, cssClass, open] = m as unknown as (string | undefined)[];
  const attributes: ErAttribute[] = [];
  if (open !== undefined && !open.includes('}')) {
    for (;;) {
      const s = lines[at.i++];
      if (s === undefined) throw lineError('Mermaid', line, `entity ${id} is never closed`);
      if (s.text === '}') break;
      attributes.push(attributeOf(s));
    }
  }
  const label = quoted ?? plain?.trim();
  return {
    kind: 'entity', id: id!, attributes, line,
    ...(label !== undefined && label !== '' ? { label } : {}),
    ...(cssClass !== undefined ? { cssClass } : {}),
  };
}

/** Parses a Mermaid ER diagram. Throws, naming the line, on text that is not one. */
export function parseErDiagram(text: string): ErDiagram {
  const source = statementsOf(text);
  if (source.header.text !== 'erDiagram') throw lineError('Mermaid', source.header.line, `expected an erDiagram header, found "${source.header.text}"`);
  const stmts: ErStmt[] = [];
  const at = { i: 0 };
  while (at.i < source.body.length) {
    const { text: t, line } = source.body[at.i++]!;
    const rel = RELATION.exec(t);
    if (rel !== null) {
      const [, from, left, body, right, to, label] = rel as unknown as string[];
      stmts.push({ kind: 'relation', from: from!, to: to!, fromCard: LEFT[left!]!, toCard: RIGHT[right!]!, dashed: body === '..', label: unquote(label!.trim()), line });
      continue;
    }
    const dir = /^direction\s+(TB|TD|BT|LR|RL)$/.exec(t);
    if (dir !== null) stmts.push({ kind: 'direction', value: dir[1]!, line });
    else if (/^(classDef|class|style)\s/.test(t)) stmts.push({ kind: 'style', text: t, line });
    else {
      const ent = ENTITY.exec(t);
      if (ent === null) throw lineError('Mermaid', line, `cannot read "${t}" as an entity or a relationship`);
      stmts.push(entityOf(ent, source.body, at, line));
    }
  }
  return { source, stmts };
}
