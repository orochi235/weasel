/** A Mermaid gitGraph's statements as the commands they run, each with its line. */
import type { GitCommand, GitCommitType } from '@weasel-js/plot';
import { lineError } from '../../lineError';
import type { Statement } from '../common/lines';

const FORMAT = 'Mermaid';
const TYPES: readonly string[] = ['NORMAL', 'REVERSE', 'HIGHLIGHT'];
/** One `key: value` attribute, its value quoted or bare. */
const ATTRIBUTE = /\s*(\w+)\s*:\s*(?:"([^"]*)"|([^\s"]+))\s*/y;
/** A branch name, quoted or bare, and what follows it. */
const NAME = /^(?:"([^"]*)"|([^\s"]+))\s*(.*)$/;

/** The attributes in `rest`, each checked against those `kind` takes. */
function attributes(rest: string, kind: string, allowed: readonly string[], line: number): Map<string, string> {
  const out = new Map<string, string>();
  let at = 0;
  while (at < rest.length) {
    ATTRIBUTE.lastIndex = at;
    const m = ATTRIBUTE.exec(rest);
    if (m === null) throw lineError(FORMAT, line, `"${rest.slice(at).trim()}" is not an attribute`);
    const key = m[1]!;
    if (!allowed.includes(key)) throw lineError(FORMAT, line, `"${key}" is not an attribute of ${kind}; it takes ${allowed.join(', ')}`);
    if (out.has(key)) throw lineError(FORMAT, line, `"${key}" is given twice`);
    out.set(key, m[2] ?? m[3]!);
    at = ATTRIBUTE.lastIndex;
  }
  return out;
}

function typeOf(value: string | undefined, line: number): { type?: GitCommitType } {
  if (value === undefined) return {};
  if (!TYPES.includes(value)) throw lineError(FORMAT, line, `"${value}" is not a commit type; it is NORMAL, REVERSE or HIGHLIGHT`);
  return { type: value as GitCommitType };
}

/** Each optional attribute named in `keys`, under the field `as` names, when `attrs` gives it. */
const fields = (attrs: Map<string, string>, keys: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(keys).flatMap(([key, as]) => (attrs.has(key) ? [[as, attrs.get(key)!]] : [])));

function nameOf(rest: string, keyword: string, line: number): { name: string; rest: string } {
  const m = NAME.exec(rest);
  if (m === null) throw lineError(FORMAT, line, `${keyword} needs a branch name`);
  return { name: m[1] ?? m[2]!, rest: m[3]! };
}

/** One statement as its command. Throws, naming the line, on one it cannot read. */
export function commandOf({ text, line }: Statement): GitCommand {
  const m = /^(\S+)\s*(.*)$/.exec(text)!;
  const keyword = m[1]!;
  const rest = m[2]!.trim();
  switch (keyword) {
    case 'commit': {
      const attrs = attributes(rest, 'commit', ['id', 'type', 'tag', 'msg'], line);
      return { kind: 'commit', ...fields(attrs, { id: 'id' }), ...typeOf(attrs.get('type'), line), ...fields(attrs, { tag: 'tag', msg: 'message' }) };
    }
    case 'branch': {
      const { name, rest: after } = nameOf(rest, 'branch', line);
      const order = attributes(after, 'branch', ['order'], line).get('order');
      if (order !== undefined && !/^\d+$/.test(order)) throw lineError(FORMAT, line, `"${order}" is not an order; it is a whole number`);
      return { kind: 'branch', name, ...(order !== undefined ? { order: Number(order) } : {}) };
    }
    case 'checkout':
    case 'switch': {
      const { name, rest: after } = nameOf(rest, keyword, line);
      if (after !== '') throw lineError(FORMAT, line, `"${after}" follows the branch name`);
      return { kind: 'checkout', name };
    }
    case 'merge': {
      const { name, rest: after } = nameOf(rest, 'merge', line);
      const attrs = attributes(after, 'merge', ['id', 'tag', 'type'], line);
      return { kind: 'merge', branch: name, ...fields(attrs, { id: 'id' }), ...typeOf(attrs.get('type'), line), ...fields(attrs, { tag: 'tag' }) };
    }
    case 'cherry-pick': {
      const attrs = attributes(rest, 'cherry-pick', ['id', 'tag', 'parent'], line);
      const id = attrs.get('id');
      if (id === undefined) throw lineError(FORMAT, line, 'cherry-pick needs the id of the commit it copies');
      return { kind: 'cherry-pick', id, ...fields(attrs, { tag: 'tag', parent: 'parent' }) };
    }
    default:
      throw lineError(FORMAT, line, `"${keyword}" is not a gitGraph statement`);
  }
}
