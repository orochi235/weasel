import { Fragment, type ReactNode } from 'react';
import { Code } from '../Code';
import { KeySequence, keySpecsFromChord } from '../Keycaps';
import { parseInline, type InlineToken } from './parseInline';

/** Props for {@link InlineMarkdown}. */
export interface InlineMarkdownProps {
  /** The line to draw, as {@link parseInline} reads it. */
  text: string;
  /** `'text'` draws a link as its label alone, for a surface that takes no interaction. */
  links?: 'anchor' | 'text';
}

/**
 * A line of prose written with inline markdown, drawn as elements in place of its punctuation: a
 * backticked span as {@link Code}, a `<kbd>` shortcut as a {@link KeySequence}, strong, emphasis, strikethrough, and links that open away from
 * the page. Renders a fragment, so it takes the type of whatever it sits in.
 */
export function InlineMarkdown({ text, links = 'anchor' }: InlineMarkdownProps) {
  return <>{draw(parseInline(text), links)}</>;
}

function draw(tokens: InlineToken[], links: 'anchor' | 'text'): ReactNode[] {
  return tokens.map((token, i) => <Fragment key={i}>{drawToken(token, links)}</Fragment>);
}

function drawToken(token: InlineToken, links: 'anchor' | 'text'): ReactNode {
  switch (token.type) {
    case 'text':
      return token.text;
    case 'code':
      return <Code>{token.text}</Code>;
    case 'keys':
      return <KeySequence keys={keySpecsFromChord(token.chord)} variant="inverse" />;
    case 'strong':
      return <strong>{draw(token.children, links)}</strong>;
    case 'em':
      return <em>{draw(token.children, links)}</em>;
    case 'del':
      return <del>{draw(token.children, links)}</del>;
    case 'link':
      return links === 'text' ? (
        draw(token.children, links)
      ) : (
        <a href={token.href} target="_blank" rel="noreferrer">
          {draw(token.children, links)}
        </a>
      );
  }
}
