import { marked, type Token, type TokensList } from 'marked';
import type { MarkdownBlock } from '../../apps/shared/markdown.ts';

/**
 * Markdown as prose and code blocks, in document order. Rendered where the
 * site is built, so the client bundle carries no markdown parser.
 *
 * @param headingShift how many levels to lower every heading by, for a document
 *   shown under a page that already has headings of its own
 */
export function blocksOf(markdown: string, headingShift = 0): MarkdownBlock[] {
  const tokens = marked.lexer(markdown);
  for (const token of tokens) {
    if (token.type === 'heading') token.depth = Math.min(6, token.depth + headingShift);
  }
  const blocks: MarkdownBlock[] = [];
  let prose: Token[] = [];

  const flush = () => {
    // The parser reads link definitions off the list it is handed.
    const html = marked.parser(Object.assign(prose, { links: tokens.links }) as TokensList).trim();
    if (html) blocks.push({ kind: 'html', html });
    prose = [];
  };

  for (const token of tokens) {
    if (token.type !== 'code') {
      prose.push(token);
      continue;
    }
    flush();
    blocks.push({ kind: 'code', code: token.text, language: token.lang ?? '' });
  }
  flush();
  return blocks;
}

/**
 * A document's `# ` title and the markdown under it. The pages that show a
 * README or a guide draw the title themselves.
 */
export function splitTitle(markdown: string): { title: string | null; body: string } {
  const match = /^\s*# +(.+?) *\n/.exec(markdown);
  if (!match) return { title: null, body: markdown };
  return { title: match[1], body: markdown.slice(match[0].length) };
}
