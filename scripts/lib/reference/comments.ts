/** TypeDoc's serialized doc comments, as the rendered prose the reference pages show. */
import type { JSONOutput } from 'typedoc';
import type { Prose } from '../../../apps/shared/reference.ts';
import { blocksOf } from '../markdownBlocks.ts';
import type { Links } from './code.ts';

type Parts = readonly JSONOutput.CommentDisplayPart[];

/** Comment text as markdown, each `{@link}` a link to the page it names. */
export function markdownOf(parts: Parts | undefined, links: Links | null): string {
  return (parts ?? []).map((part) => (part.kind === 'inline-tag' ? inlineTag(part, links) : part.text)).join('');
}

function inlineTag(part: JSONOutput.InlineTagDisplayPart, links: Links | null): string {
  if (!part.tag.startsWith('@link')) return part.text;
  const label = part.tag === '@linkplain' ? part.text : `\`${part.text}\``;
  const href = links ? hrefOf(part, links) : undefined;
  return href ? `[${label}](${href})` : label;
}

function hrefOf(part: JSONOutput.InlineTagDisplayPart, links: Links): string | undefined {
  const { target } = part;
  if (typeof target === 'string') return target;
  const to = typeof target === 'number' ? links.byId(target) : target ? links.byName(target.packageName, target.qualifiedName) : undefined;
  return to === undefined ? undefined : `#${to}`;
}

export function proseOf(parts: Parts | undefined, links: Links): Prose {
  return blocksOf(markdownOf(parts, links));
}

/** Block tags the pages show somewhere other than the body, or not at all. */
const NOT_IN_BODY = new Set([
  '@param', '@returns', '@return', '@deprecated', '@typeParam', '@template', '@category', '@group',
  '@categoryDescription', '@groupDescription', '@module', '@privateRemarks', '@summary',
]);

const LABELS: Record<string, string> = {
  '@see': 'See also',
  '@throws': 'Throws',
  '@default': 'Default',
  '@defaultValue': 'Default',
  '@since': 'Since',
};

/** A comment's summary and the block tags that read as part of it, in the order written. */
export function docOf(comment: JSONOutput.Comment | undefined, links: Links): Prose {
  if (!comment) return [];
  const sections = [markdownOf(comment.summary, links)];
  for (const tag of comment.blockTags ?? []) {
    if (NOT_IN_BODY.has(tag.tag)) continue;
    const text = markdownOf(tag.content, links).trim();
    if (tag.tag === '@remarks') sections.push(text);
    else if (tag.tag === '@example') sections.push(`#### Example\n\n${text}`);
    else sections.push(`**${LABELS[tag.tag] ?? tag.tag.slice(1)}** ${text}`);
  }
  return blocksOf(sections.filter(Boolean).join('\n\n'));
}

/** What one block tag says, or `undefined` when the comment has no such tag. */
export function tagProse(comment: JSONOutput.Comment | undefined, tag: string, links: Links, name?: string): Prose | undefined {
  const found = comment?.blockTags?.find((t) => t.tag === tag && (name === undefined || t.name === name));
  return found ? proseOf(found.content, links) : undefined;
}

/**
 * A comment's first sentence, as inline markdown with its links written as
 * plain names: the line beside an export in a list.
 */
export function summaryOf(comment: JSONOutput.Comment | undefined): string {
  const paragraph = markdownOf(comment?.summary, null).split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  const sentence = /^.*?[.!?](?=\s+[A-Z`]|$)/.exec(paragraph);
  return sentence ? sentence[0] : paragraph;
}
