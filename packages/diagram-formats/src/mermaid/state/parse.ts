/** A Mermaid state diagram's grammar, read to statements with each one's line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource, type Statement } from '../common/lines';

/** A state's kind, when `<<…>>` names one. */
export type StateType = 'fork' | 'join' | 'choice';

export type StateStmt =
  | { kind: 'transition'; from: string; to: string; label?: string; line: number }
  | { kind: 'state'; id: string; label?: string; type?: StateType; line: number }
  | { kind: 'describe'; id: string; text: string; line: number }
  | { kind: 'composite'; id: string; label?: string; regions: StateStmt[][]; line: number }
  | { kind: 'note'; side: 'left' | 'right'; id: string; text: string; line: number }
  | { kind: 'assign'; id: string; name: string; line: number }
  | { kind: 'direction'; value: string; line: number }
  | { kind: 'style'; text: string; line: number }
  | { kind: 'other'; keyword: string; line: number };

/** A whole state diagram. */
export interface StateDiagram {
  source: MermaidSource;
  stmts: StateStmt[];
}

/** A state's id, `[*]` for the start or end of its scope, and the class `:::` gives it. */
const END = String.raw`(\[\*\]|[\w-]+)(?::::([\w-]+))?`;
const TRANSITION = new RegExp(`^${END}\\s*-->\\s*${END}\\s*(?::\\s*(.*))?$`);
const STATE_AS = /^state\s+"([^"]*)"\s+as\s+([\w-]+)\s*(\{)?$/;
const STATE_TYPE = /^state\s+([\w-]+)\s+<<\s*(fork|join|choice)\s*>>$/;
const STATE = /^state\s+([\w-]+)\s*(\{)?$/;
const BARE = /^([\w-]+)(?::::([\w-]+))?$/;
const DESCRIBE = /^([\w-]+)\s*:\s*(.+)$/;
const NOTE = /^note\s+(left|right)\s+of\s+([\w-]+)\s*(?::\s*(.*))?$/;

class StateParser {
  i = 0;

  constructor(readonly lines: readonly Statement[]) {}

  /** The regions of the block opened on line `opened`, split at `--`, to its `}`; the whole diagram when `opened` is null. */
  block(opened: number | null): StateStmt[][] {
    const regions: StateStmt[][] = [[]];
    while (this.i < this.lines.length) {
      const s = this.lines[this.i++]!;
      if (s.text === '}') {
        if (opened === null) throw lineError('Mermaid', s.line, '"}" closes no state');
        return regions;
      }
      if (s.text === '--') {
        if (opened === null) throw lineError('Mermaid', s.line, '"--" divides only a composite state');
        regions.push([]);
        continue;
      }
      regions.at(-1)!.push(...this.stmt(s));
    }
    if (opened !== null) throw lineError('Mermaid', opened, 'a composite state opened here is never closed');
    return regions;
  }

  stmt({ text, line }: Statement): StateStmt[] {
    const t = TRANSITION.exec(text);
    if (t !== null) {
      const [, from, fromClass, to, toClass, label] = t as unknown as (string | undefined)[];
      return [
        { kind: 'transition', from: from!, to: to!, ...(label !== undefined && label.trim() !== '' ? { label: label.trim() } : {}), line },
        ...(fromClass !== undefined ? [{ kind: 'assign' as const, id: from!, name: fromClass, line }] : []),
        ...(toClass !== undefined ? [{ kind: 'assign' as const, id: to!, name: toClass, line }] : []),
      ];
    }
    const as = STATE_AS.exec(text);
    if (as !== null) return [as[3] !== undefined ? this.composite(as[2]!, as[1]!, line) : { kind: 'state', id: as[2]!, label: as[1]!, line }];
    const typed = STATE_TYPE.exec(text);
    if (typed !== null) return [{ kind: 'state', id: typed[1]!, type: typed[2] as StateType, line }];
    const st = STATE.exec(text);
    if (st !== null) return [st[2] !== undefined ? this.composite(st[1]!, undefined, line) : { kind: 'state', id: st[1]!, line }];
    const note = NOTE.exec(text);
    if (note !== null) return [{ kind: 'note', side: note[1] as 'left' | 'right', id: note[2]!, text: note[3] ?? this.noteBody(line), line }];
    const dir = /^direction\s+(TB|TD|BT|LR|RL)$/.exec(text);
    if (dir !== null) return [{ kind: 'direction', value: dir[1]!, line }];
    if (/^(classDef|class|style)\s/.test(text)) return [{ kind: 'style', text, line }];
    const bare = BARE.exec(text);
    if (bare !== null) {
      return [{ kind: 'state', id: bare[1]!, line }, ...(bare[2] !== undefined ? [{ kind: 'assign' as const, id: bare[1]!, name: bare[2], line }] : [])];
    }
    const desc = DESCRIBE.exec(text);
    if (desc !== null) return [{ kind: 'describe', id: desc[1]!, text: desc[2]!.trim(), line }];
    const keyword = /^(hide|scale|click)\b/.exec(text);
    if (keyword !== null) return [{ kind: 'other', keyword: keyword[1]!, line }];
    throw lineError('Mermaid', line, `cannot read "${text}" as a state diagram statement`);
  }

  composite(id: string, label: string | undefined, line: number): StateStmt {
    return { kind: 'composite', id, ...(label !== undefined ? { label } : {}), regions: this.block(line), line };
  }

  /** A note's lines up to `end note`. */
  noteBody(opened: number): string {
    const out: string[] = [];
    for (;;) {
      const s = this.lines[this.i++];
      if (s === undefined) throw lineError('Mermaid', opened, 'a note opened here has no "end note"');
      if (s.text === 'end note') return out.join('\n');
      out.push(s.text);
    }
  }
}

/** Parses a Mermaid state diagram, `stateDiagram` or `stateDiagram-v2`. Throws, naming the line, on text that is not one. */
export function parseStateDiagram(text: string): StateDiagram {
  const source = statementsOf(text);
  if (!/^stateDiagram(-v2)?$/.test(source.header.text)) {
    throw lineError('Mermaid', source.header.line, `expected a stateDiagram header, found "${source.header.text}"`);
  }
  return { source, stmts: new StateParser(source.body).block(null)[0]! };
}
