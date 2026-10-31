/** The pieces of Mermaid's `sequenceDiagram` syntax both the reader and the writer know: arrows, participant types, and text. */
import type { Outline, SeqMessage } from '@weasel-js/diagram';
import { markupLines } from '../../graphRead';

/** A message's arrow, as its line, head, and whether it has a head at both ends. */
export type Arrow = Pick<SeqMessage, 'line' | 'head'> & { both?: true; async?: true };

/** Every arrow, longest first, so a match never stops at a shorter arrow's prefix. */
export const ARROWS: readonly (readonly [string, Arrow])[] = [
  ['<<-->>', { line: 'dashed', head: 'arrow', both: true }],
  ['<<->>', { line: 'solid', head: 'arrow', both: true }],
  ['-->>', { line: 'dashed', head: 'arrow' }],
  ['->>', { line: 'solid', head: 'arrow' }],
  ['--x', { line: 'dashed', head: 'cross' }],
  ['-x', { line: 'solid', head: 'cross' }],
  ['--)', { line: 'dashed', head: 'open', async: true }],
  ['-)', { line: 'solid', head: 'open', async: true }],
  ['-->', { line: 'dashed', head: 'none' }],
  ['->', { line: 'solid', head: 'none' }],
];

/** The arrow that writes `m`, and whether it lost its second head. */
export function arrowOf(m: Pick<SeqMessage, 'line' | 'head' | 'both'>): { arrow: string; dropsBoth: boolean } {
  const both = m.both === true && m.head === 'arrow';
  const found = ARROWS.find(([, a]) => a.line === m.line && a.head === m.head && (a.both === true) === both)!;
  return { arrow: found[0], dropsBoth: m.both === true && !both };
}

/** A participant type's outline. `participant` is a plain box. */
export const TYPE_OUTLINES: Readonly<Record<string, Outline | undefined>> = {
  participant: undefined, actor: 'actor', boundary: 'boundary', control: 'control', entity: 'entity', database: 'cylinder',
  collections: 'collections', queue: 'queue',
};

/** The participant type that draws `outline`, or `null` for one Mermaid has no type for. */
export function typeOf(outline: Outline | undefined): string | null {
  if (outline === undefined || outline === 'rect') return 'participant';
  return Object.entries(TYPE_OUTLINES).find(([, o]) => o === outline)?.[0] ?? null;
}

/** Mermaid's text as plain text: `<br>` a line break, entities read. */
export const plainText = (text: string): string => markupLines(text.trim(), true).join('\n');

const ENTITIES: Readonly<Record<string, string>> = { '#': '#35;', ';': '#59;', '<': '#lt;', '>': '#gt;' };

/** Text as Mermaid writes it in a sequence: line breaks as `<br>`, and what it reads as syntax as entities. */
export const mermaidSeqText = (text: string): string =>
  text.split('\n').map((l) => l.replace(/[#;<>]/g, (c) => ENTITIES[c]!)).join('<br>');