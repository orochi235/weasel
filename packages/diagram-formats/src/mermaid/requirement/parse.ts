/** A Mermaid requirement diagram's grammar, read to statements with each one's line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource } from '../common/lines';
import { unquote } from '../common/text';

/** The block keywords: the requirement kinds, and `element`. */
export const BLOCK_KINDS = [
  'requirement', 'functionalRequirement', 'interfaceRequirement', 'performanceRequirement', 'physicalRequirement', 'designConstraint', 'element',
] as const;

/** How one block relates to another. */
export const RELATIONS = ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces'] as const;

export type RequirementStmt =
  | { kind: 'block'; type: (typeof BLOCK_KINDS)[number]; name: string; fields: [string, string][]; line: number }
  | { kind: 'relation'; from: string; to: string; type: (typeof RELATIONS)[number]; line: number }
  | { kind: 'direction'; value: string; line: number }
  | { kind: 'style'; text: string; line: number };

/** A whole requirement diagram. */
export interface RequirementDiagram {
  source: MermaidSource;
  stmts: RequirementStmt[];
}

const NAME = String.raw`("[^"]*"|[\w-]+)`;
const TYPE = `(${RELATIONS.join('|')})`;
const BLOCK = new RegExp(`^(${BLOCK_KINDS.join('|')})\\s+${NAME}\\s*\\{$`);
const FORWARD = new RegExp(`^${NAME}\\s*-\\s*${TYPE}\\s*->\\s*${NAME}$`);
const BACKWARD = new RegExp(`^${NAME}\\s*<-\\s*${TYPE}\\s*-\\s*${NAME}$`);

/** Parses a Mermaid requirement diagram. Throws, naming the line, on text that is not one. */
export function parseRequirementDiagram(text: string): RequirementDiagram {
  const source = statementsOf(text);
  if (source.header.text !== 'requirementDiagram') {
    throw lineError('Mermaid', source.header.line, `expected a requirementDiagram header, found "${source.header.text}"`);
  }
  const stmts: RequirementStmt[] = [];
  const body = source.body;
  for (let i = 0; i < body.length; i++) {
    const { text: t, line } = body[i]!;
    const block = BLOCK.exec(t);
    const fwd = FORWARD.exec(t);
    const back = BACKWARD.exec(t);
    if (block !== null) {
      const fields: [string, string][] = [];
      for (i++; i < body.length && body[i]!.text !== '}'; i++) {
        const f = /^(\w+)\s*:\s*(.*)$/.exec(body[i]!.text);
        if (f === null) throw lineError('Mermaid', body[i]!.line, `cannot read "${body[i]!.text}" as a field: a name, a colon, and a value`);
        fields.push([f[1]!, unquote(f[2]!.trim())]);
      }
      if (i >= body.length) throw lineError('Mermaid', line, `${block[1]} ${block[2]} is never closed`);
      stmts.push({ kind: 'block', type: block[1] as (typeof BLOCK_KINDS)[number], name: unquote(block[2]!), fields, line });
    } else if (fwd !== null) {
      stmts.push({ kind: 'relation', from: unquote(fwd[1]!), type: fwd[2] as (typeof RELATIONS)[number], to: unquote(fwd[3]!), line });
    } else if (back !== null) {
      stmts.push({ kind: 'relation', from: unquote(back[3]!), type: back[2] as (typeof RELATIONS)[number], to: unquote(back[1]!), line });
    } else if (/^direction\s+(TB|TD|BT|LR|RL)$/.test(t)) {
      stmts.push({ kind: 'direction', value: t.split(/\s+/)[1]!, line });
    } else if (/^(classDef|class|style)\s/.test(t)) {
      stmts.push({ kind: 'style', text: t, line });
    } else {
      throw lineError('Mermaid', line, `cannot read "${t}" as a requirement, an element, or a relationship`);
    }
  }
  return { source, stmts };
}
