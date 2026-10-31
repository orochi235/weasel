/** A Mermaid mind map's grammar: an indented tree of nodes, read with each one's line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource } from '../common/lines';

/** A node's shape, by the brackets around its text; `plain` for none. */
export type MindmapShape = 'plain' | 'square' | 'rounded' | 'circle' | 'bang' | 'cloud' | 'hexagon';

/** One node and the nodes indented under it. */
export interface MindmapNode {
  id?: string;
  text: string;
  shape: MindmapShape;
  /** What `::icon(…)` and `:::` gave it, which a diagram does not hold. */
  icon?: string;
  classes?: string;
  children: MindmapNode[];
  line: number;
}

/** A whole mind map. */
export interface Mindmap {
  source: MermaidSource;
  root: MindmapNode | null;
}

/** Openers, longest first, each with its closer. */
const SHAPES: readonly (readonly [string, string, MindmapShape])[] = [
  ['((', '))', 'circle'], ['))', '((', 'bang'], ['{{', '}}', 'hexagon'], ['(', ')', 'rounded'], [')', '(', 'cloud'], ['[', ']', 'square'],
];

function nodeOf(text: string, line: number): MindmapNode {
  const at = text.search(/[([{)]/);
  if (at >= 0) {
    const id = text.slice(0, at).trim();
    const rest = text.slice(at);
    const shape = SHAPES.find(([open, close]) => rest.startsWith(open) && rest.endsWith(close) && rest.length >= open.length + close.length);
    if (shape !== undefined && /^[\w-]*$/.test(id)) {
      const inner = rest.slice(shape[0].length, rest.length - shape[1].length).trim();
      return { ...(id !== '' ? { id } : {}), text: /^".*"$/s.test(inner) ? inner.slice(1, -1) : inner, shape: shape[2], children: [], line };
    }
    if (shape === undefined && /^[\w-]*$/.test(id) && id !== '') throw lineError('Mermaid', line, `the shape around "${rest}" is never closed`);
  }
  return { text: /^".*"$/s.test(text) ? text.slice(1, -1) : text, shape: 'plain', children: [], line };
}

/** Parses a Mermaid mind map. Throws, naming the line, on text that is not one, or on a second root. */
export function parseMindmap(text: string): Mindmap {
  const source = statementsOf(text);
  if (source.header.text !== 'mindmap') throw lineError('Mermaid', source.header.line, `expected a mindmap header, found "${source.header.text}"`);
  let root: MindmapNode | null = null;
  const stack: { indent: number; node: MindmapNode }[] = [];
  for (const s of source.body) {
    const last = stack.at(-1)?.node;
    const icon = /^::icon\((.*)\)$/.exec(s.text);
    const classes = /^:::\s*(.*)$/.exec(s.text);
    if (icon !== null || classes !== null) {
      if (last === undefined) throw lineError('Mermaid', s.line, 'an icon or class must follow a node');
      if (icon !== null) last.icon = icon[1]!;
      else last.classes = classes![1]!;
      continue;
    }
    const node = nodeOf(s.text, s.line);
    while (stack.length > 0 && stack.at(-1)!.indent >= s.indent) stack.pop();
    const parent = stack.at(-1)?.node;
    if (parent !== undefined) parent.children.push(node);
    else if (root === null) root = node;
    else throw lineError('Mermaid', s.line, 'a mind map has one root; this line is indented no deeper than it');
    stack.push({ indent: s.indent, node });
  }
  return { source, root };
}
